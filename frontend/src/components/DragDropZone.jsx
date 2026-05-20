import { useRef, useState } from "react";
import styles from "./DragDropZone.module.css";

function matchesAccept(file, accept) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return accept.split(",").some((part) => {
    const rule = part.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

export default function DragDropZone({
  accept,
  onFile,
  children,
  className = "",
  disabled = false,
  clickToBrowse = true,
  inputProps = {},
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = (file) => {
    if (!file || disabled) return;
    if (!matchesAccept(file, accept)) return;
    onFile(file);
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragging(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    pickFile(file);
  };

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ""} ${disabled ? styles.disabled : ""} ${!clickToBrowse ? styles.dropOnly : ""} ${className}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => clickToBrowse && !disabled && inputRef.current?.click()}
      role={clickToBrowse ? "button" : undefined}
      tabIndex={clickToBrowse && !disabled ? 0 : undefined}
      onKeyDown={
        clickToBrowse
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }
          : undefined
      }
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        disabled={disabled}
        onChange={(e) => pickFile(e.target.files?.[0])}
        {...inputProps}
      />
      {children}
    </div>
  );
}
