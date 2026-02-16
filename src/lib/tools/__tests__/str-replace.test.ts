import { describe, it, expect, beforeEach } from "vitest";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { VirtualFileSystem } from "@/lib/file-system";

describe("str-replace tool", () => {
  let fileSystem: VirtualFileSystem;
  let tool: ReturnType<typeof buildStrReplaceTool>;

  beforeEach(() => {
    fileSystem = new VirtualFileSystem();
    tool = buildStrReplaceTool(fileSystem);
  });

  describe("tool structure", () => {
    it("should have correct id", () => {
      expect(tool.id).toBe("str_replace_editor");
    });

    it("should have parameters schema", () => {
      expect(tool.parameters).toBeDefined();
    });

    it("should have execute function", () => {
      expect(typeof tool.execute).toBe("function");
    });
  });

  describe("view command", () => {
    it("should view file contents with line numbers", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
      });

      expect(result).toBe("1\tline1\n2\tline2\n3\tline3");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.execute({
        command: "view",
        path: "/nonexistent.txt",
      });

      expect(result).toBe("File not found: /nonexistent.txt");
    });

    it("should view directory contents", async () => {
      fileSystem.createFile("/dir/file1.txt", "content1");
      fileSystem.createFile("/dir/file2.txt", "content2");

      const result = await tool.execute({
        command: "view",
        path: "/dir",
      });

      expect(result).toContain("[FILE] file1.txt");
      expect(result).toContain("[FILE] file2.txt");
    });

    it("should view empty directory", async () => {
      fileSystem.createDirectory("/empty");

      const result = await tool.execute({
        command: "view",
        path: "/empty",
      });

      expect(result).toBe("(empty directory)");
    });

    it("should view file with range", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3\nline4\nline5");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [2, 4],
      });

      expect(result).toBe("2\tline2\n3\tline3\n4\tline4");
    });

    it("should handle view_range with -1 for end of file", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [2, -1],
      });

      expect(result).toBe("2\tline2\n3\tline3");
    });

    it("should view empty file", async () => {
      fileSystem.createFile("/empty.txt", "");

      const result = await tool.execute({
        command: "view",
        path: "/empty.txt",
      });

      // Empty file still has one line (empty string), shown as "1\t"
      expect(result).toBe("1\t");
    });
  });

  describe("create command", () => {
    it("should create a new file", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/new-file.txt",
        file_text: "Hello, World!",
      });

      expect(result).toBe("File created: /new-file.txt");
      expect(fileSystem.readFile("/new-file.txt")).toBe("Hello, World!");
    });

    it("should create file with empty content when file_text not provided", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/empty-file.txt",
      });

      expect(result).toBe("File created: /empty-file.txt");
      expect(fileSystem.readFile("/empty-file.txt")).toBe("");
    });

    it("should create parent directories automatically", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/deep/nested/dir/file.txt",
        file_text: "content",
      });

      expect(result).toBe("File created: /deep/nested/dir/file.txt");
      expect(fileSystem.exists("/deep")).toBe(true);
      expect(fileSystem.exists("/deep/nested")).toBe(true);
      expect(fileSystem.exists("/deep/nested/dir")).toBe(true);
    });

    it("should return error when file already exists", async () => {
      fileSystem.createFile("/existing.txt", "original");

      const result = await tool.execute({
        command: "create",
        path: "/existing.txt",
        file_text: "new content",
      });

      expect(result).toBe("Error: File already exists: /existing.txt");
      expect(fileSystem.readFile("/existing.txt")).toBe("original");
    });
  });

  describe("str_replace command", () => {
    it("should replace string in file", async () => {
      fileSystem.createFile("/test.txt", "Hello, World!");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "World",
        new_str: "Universe",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("Hello, Universe!");
    });

    it("should replace multiple occurrences", async () => {
      fileSystem.createFile("/test.txt", "foo bar foo baz foo");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "foo",
        new_str: "qux",
      });

      expect(result).toBe("Replaced 3 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("qux bar qux baz qux");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.execute({
        command: "str_replace",
        path: "/nonexistent.txt",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe("Error: File not found: /nonexistent.txt");
    });

    it("should return error when string not found", async () => {
      fileSystem.createFile("/test.txt", "Hello, World!");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe('Error: String not found in file: "foo"');
    });

    it("should return error when trying to edit a directory", async () => {
      fileSystem.createDirectory("/mydir");

      const result = await tool.execute({
        command: "str_replace",
        path: "/mydir",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe("Error: Cannot edit a directory: /mydir");
    });

    it("should handle replacement with empty string", async () => {
      fileSystem.createFile("/test.txt", "Hello, World!");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: ", World",
        new_str: "",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("Hello!");
    });

    it("should handle regex special characters in old_str", async () => {
      fileSystem.createFile("/test.txt", "Price: $100 (USD)");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "$100 (USD)",
        new_str: "€85 (EUR)",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("Price: €85 (EUR)");
    });

    it("should return error when old_str is empty", async () => {
      fileSystem.createFile("/test.txt", "Hello, World!");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "",
        new_str: "bar",
      });

      expect(result).toBe('Error: String not found in file: ""');
    });
  });

  describe("insert command", () => {
    it("should insert text at specified line", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 1,
        new_str: "inserted",
      });

      expect(result).toBe("Text inserted at line 1 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\ninserted\nline2\nline3");
    });

    it("should insert at beginning of file (line 0)", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 0,
        new_str: "first",
      });

      expect(result).toBe("Text inserted at line 0 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("first\nline1\nline2");
    });

    it("should insert at end of file", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 2,
        new_str: "last",
      });

      expect(result).toBe("Text inserted at line 2 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\nline2\nlast");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.execute({
        command: "insert",
        path: "/nonexistent.txt",
        insert_line: 0,
        new_str: "text",
      });

      expect(result).toBe("Error: File not found: /nonexistent.txt");
    });

    it("should return error for invalid line number (negative)", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: -1,
        new_str: "text",
      });

      expect(result).toBe("Error: Invalid line number: -1. File has 2 lines.");
    });

    it("should return error for invalid line number (too large)", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 10,
        new_str: "text",
      });

      expect(result).toBe("Error: Invalid line number: 10. File has 2 lines.");
    });

    it("should return error when trying to insert into a directory", async () => {
      fileSystem.createDirectory("/mydir");

      const result = await tool.execute({
        command: "insert",
        path: "/mydir",
        insert_line: 0,
        new_str: "text",
      });

      expect(result).toBe("Error: Cannot edit a directory: /mydir");
    });

    it("should insert empty string when new_str not provided", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 1,
      });

      expect(result).toBe("Text inserted at line 1 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\n\nline2");
    });
  });

  describe("undo_edit command", () => {
    it("should return not supported error", async () => {
      fileSystem.createFile("/test.txt", "content");

      const result = await tool.execute({
        command: "undo_edit",
        path: "/test.txt",
      });

      expect(result).toBe(
        "Error: undo_edit command is not supported in this version. Use str_replace to revert changes."
      );
    });
  });

  describe("edge cases", () => {
    it("should handle paths without leading slash", async () => {
      const result = await tool.execute({
        command: "create",
        path: "test.txt",
        file_text: "content",
      });

      expect(result).toBe("File created: test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("content");
    });

    it("should handle multiline content", async () => {
      const multilineContent = `function hello() {
  console.log("Hello, World!");
}

export default hello;`;

      const result = await tool.execute({
        command: "create",
        path: "/hello.js",
        file_text: multilineContent,
      });

      expect(result).toBe("File created: /hello.js");
      expect(fileSystem.readFile("/hello.js")).toBe(multilineContent);
    });

    it("should handle special characters in content", async () => {
      const specialContent = "Special chars: <>&\"'`${}[]|\\";

      await tool.execute({
        command: "create",
        path: "/special.txt",
        file_text: specialContent,
      });

      expect(fileSystem.readFile("/special.txt")).toBe(specialContent);
    });
  });
});
