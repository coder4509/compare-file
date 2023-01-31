import React from "react";

export default function ListCard(props) {
  const {
    sourcePath,
    targetPath,
    isViewed,
    handleDiff,
    indexKey,
    position,
    isNew = false,
    diffTotal
  } = props;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        border: " 1px solid #ccc",
        padding: "1rem",
        margin: "20px",
        borderRadius: "10px",
        cursor: "pointer",
        ...(isViewed ? { background: "#5cb45c" } : {}),
      }}
      key={`${indexKey}_${Date.now()}`}
      id="list-card"
    >
      <div style={{ flexGrow: 1, overflowX: "scroll", width: "80%" }}>
        {sourcePath}
      </div>
      <div style={{ width: "10%" }}>
        {!isNew ? (
          <button
            onClick={(e) => handleDiff(e, sourcePath, targetPath, position)}
          >
            Check Diff
          </button>
        ) : (
          <button
            onClick={(e) => handleDiff(e, sourcePath, targetPath, position)}
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
