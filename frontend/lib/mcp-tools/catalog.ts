/**
 * The full list of MCP tools this server can register, independent of
 * whether any given one is currently enabled (spec 024-tools-status-page
 * research.md §1). A disabled tool is never registered on the live
 * McpServer (spec 023), so this list can't be derived by introspecting a
 * server instance — it must be kept in sync by hand with the
 * `register*Tools` calls in this directory. The canonical list lives in
 * ../../../specs/023-mcp-tool-toggle/contracts/mcp-tool-toggle-config.md.
 */
export interface ToolCatalogEntry {
  name: string;
  group: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: "create_file", group: "File & Directory" },
  { name: "read_file", group: "File & Directory" },
  { name: "delete_file", group: "File & Directory" },
  { name: "create_directory", group: "File & Directory" },
  { name: "list_directory", group: "File & Directory" },
  { name: "delete_directory", group: "File & Directory" },
  { name: "update_file", group: "File & Directory" },
  { name: "move", group: "File & Directory" },
  { name: "create_binary_file", group: "File & Directory" },
  { name: "read_binary_file", group: "File & Directory" },
  { name: "get_os_engine", group: "Engine" },
  { name: "get_os_upgrade", group: "Engine" },
  { name: "get_os_init", group: "Engine" },
  { name: "send_email", group: "Messaging" },
  { name: "send_telegram_message", group: "Messaging" },
  { name: "get_inbox", group: "Inbox" },
  { name: "list_directory_tree", group: "Tree Search" },
  { name: "find_files_by_name", group: "Tree Search" },
  { name: "search_file_content", group: "Tree Search" },
];
