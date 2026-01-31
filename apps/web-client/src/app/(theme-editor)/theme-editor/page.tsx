import { Metadata } from "next";
import Editor from "@/components/theme-editor/editor";

export const metadata: Metadata = {
  title: "Theme Editor",
  description: "Customize your theme colors and styles.",
};

export default function EditorPage() {
  return <Editor />;
}
