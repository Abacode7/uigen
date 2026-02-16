import { describe, it, expect, beforeEach } from "vitest";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { VirtualFileSystem } from "@/lib/file-system";

describe("file-manager tool", () => {
  let fileSystem: VirtualFileSystem;
  let tool: ReturnType<typeof buildFileManagerTool>;

  beforeEach(() => {
    fileSystem = new VirtualFileSystem();
    tool = buildFileManagerTool(fileSystem);
  });

  describe("tool structure", () => {
    it("should have description", () => {
      expect(tool.description).toContain("Rename or delete");
    });

    it("should have parameters schema", () => {
      expect(tool.parameters).toBeDefined();
    });

    it("should have execute function", () => {
      expect(typeof tool.execute).toBe("function");
    });
  });

  describe("rename command", () => {
    it("should rename a file successfully", async () => {
      fileSystem.createFile("/old.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/old.txt",
        new_path: "/new.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /old.txt to /new.txt",
      });
      expect(fileSystem.exists("/old.txt")).toBe(false);
      expect(fileSystem.exists("/new.txt")).toBe(true);
      expect(fileSystem.readFile("/new.txt")).toBe("content");
    });

    it("should move a file to a new directory", async () => {
      fileSystem.createFile("/file.txt", "content");
      fileSystem.createDirectory("/newdir");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/newdir/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /file.txt to /newdir/file.txt",
      });
      expect(fileSystem.exists("/file.txt")).toBe(false);
      expect(fileSystem.readFile("/newdir/file.txt")).toBe("content");
    });

    it("should create parent directories when moving", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/deep/nested/dir/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /file.txt to /deep/nested/dir/file.txt",
      });
      expect(fileSystem.exists("/deep/nested/dir")).toBe(true);
      expect(fileSystem.readFile("/deep/nested/dir/file.txt")).toBe("content");
    });

    it("should rename a directory", async () => {
      fileSystem.createFile("/olddir/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/olddir",
        new_path: "/newdir",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /olddir to /newdir",
      });
      expect(fileSystem.exists("/olddir")).toBe(false);
      expect(fileSystem.exists("/newdir")).toBe(true);
      expect(fileSystem.readFile("/newdir/file.txt")).toBe("content");
    });

    it("should return error when new_path is not provided", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
    });

    it("should return error when source does not exist", async () => {
      const result = await tool.execute({
        command: "rename",
        path: "/nonexistent.txt",
        new_path: "/new.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /nonexistent.txt to /new.txt",
      });
    });

    it("should return error when destination already exists", async () => {
      fileSystem.createFile("/source.txt", "source");
      fileSystem.createFile("/dest.txt", "dest");

      const result = await tool.execute({
        command: "rename",
        path: "/source.txt",
        new_path: "/dest.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /source.txt to /dest.txt",
      });
      expect(fileSystem.readFile("/dest.txt")).toBe("dest");
    });

    it("should not allow renaming root directory", async () => {
      const result = await tool.execute({
        command: "rename",
        path: "/",
        new_path: "/newroot",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename / to /newroot",
      });
    });

    it("should not allow renaming to root", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /file.txt to /",
      });
    });
  });

  describe("delete command", () => {
    it("should delete a file successfully", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "delete",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /file.txt",
      });
      expect(fileSystem.exists("/file.txt")).toBe(false);
    });

    it("should delete an empty directory", async () => {
      fileSystem.createDirectory("/emptydir");

      const result = await tool.execute({
        command: "delete",
        path: "/emptydir",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /emptydir",
      });
      expect(fileSystem.exists("/emptydir")).toBe(false);
    });

    it("should delete a directory with contents recursively", async () => {
      fileSystem.createFile("/dir/file1.txt", "content1");
      fileSystem.createFile("/dir/file2.txt", "content2");
      fileSystem.createFile("/dir/subdir/file3.txt", "content3");

      const result = await tool.execute({
        command: "delete",
        path: "/dir",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /dir",
      });
      expect(fileSystem.exists("/dir")).toBe(false);
      expect(fileSystem.exists("/dir/file1.txt")).toBe(false);
      expect(fileSystem.exists("/dir/subdir")).toBe(false);
    });

    it("should return error when file does not exist", async () => {
      const result = await tool.execute({
        command: "delete",
        path: "/nonexistent.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to delete /nonexistent.txt",
      });
    });

    it("should not delete root directory", async () => {
      const result = await tool.execute({
        command: "delete",
        path: "/",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to delete /",
      });
      expect(fileSystem.exists("/")).toBe(true);
    });
  });

  describe("invalid command", () => {
    it("should return error for unknown command", async () => {
      // Cast to bypass TypeScript enum check
      const result = await tool.execute({
        command: "unknown" as "rename",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Invalid command",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle paths without leading slash", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "delete",
        path: "file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted file.txt",
      });
      expect(fileSystem.exists("/file.txt")).toBe(false);
    });

    it("should handle paths with trailing slash", async () => {
      fileSystem.createDirectory("/mydir");

      const result = await tool.execute({
        command: "delete",
        path: "/mydir/",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /mydir/",
      });
      expect(fileSystem.exists("/mydir")).toBe(false);
    });

    it("should rename file with special characters in name", async () => {
      fileSystem.createFile("/my file (1).txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/my file (1).txt",
        new_path: "/my_file_1.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /my file (1).txt to /my_file_1.txt",
      });
      expect(fileSystem.readFile("/my_file_1.txt")).toBe("content");
    });

    it("should handle deeply nested file operations", async () => {
      fileSystem.createFile("/a/b/c/d/e/file.txt", "deep content");

      const deleteResult = await tool.execute({
        command: "delete",
        path: "/a/b/c/d/e/file.txt",
      });

      expect(deleteResult.success).toBe(true);

      // Parent directories should still exist
      expect(fileSystem.exists("/a/b/c/d/e")).toBe(true);
      expect(fileSystem.exists("/a/b/c/d/e/file.txt")).toBe(false);
    });

    it("should preserve file content during rename", async () => {
      const largeContent = "x".repeat(10000);
      fileSystem.createFile("/large.txt", largeContent);

      await tool.execute({
        command: "rename",
        path: "/large.txt",
        new_path: "/renamed.txt",
      });

      expect(fileSystem.readFile("/renamed.txt")).toBe(largeContent);
    });
  });
});
