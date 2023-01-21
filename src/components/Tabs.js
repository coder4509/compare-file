import React from "react";

export default function TabView({ statsData, selectTab, tabList }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {tabList.map((tabItem) => {
          const { id, name, isSelected } = tabItem;
          let count = 0;
          if (tabItem.id === "newFile") {
            count = statsData.newF;
          }
          if (tabItem.id === "diffFile") {
            count = statsData.diff;
          }
          return (
            <div
              onClick={() => {
                selectTab(id);
              }}
              className={isSelected ? "item-active" : "item"}
            >
              {name} <span className="badge">{count}</span>
            </div>
          );
        })}
      </div>
      <hr />
    </div>
  );
}
