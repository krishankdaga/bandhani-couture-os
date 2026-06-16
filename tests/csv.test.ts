import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, toCsv } from "@/lib/csv";

test("CSV escaping handles commas, quotes and newlines", () => {
  assert.equal(csvCell("A, B"), '"A, B"');
  assert.equal(csvCell('A "quoted" value'), '"A ""quoted"" value"');
  assert.equal(csvCell("line 1\nline 2"), '"line 1\nline 2"');
  assert.equal(toCsv(["Name"], [["Bandhani"]]), "Name\r\nBandhani");
});
