import type { ReactNode } from "react";
import "./app.scss";

export default function App(props: { children: ReactNode }) {
  return props.children;
}
