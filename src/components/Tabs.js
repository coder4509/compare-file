import React, { useState } from "react";
import { DiffList, NewList } from "../module";

const tabs = [
  {
    name: "Total New",
    isSelected: false,
    id: "newFile",
  },
  {
    name: "Total Diff",
    isSelected: true,
    id: "diffFile",
  },
];

export default function TabView({
  listDiff = [],
  listNew = [],
  handleNew,
  handleDiff,
  statsData,
}) {
  const [tabList, setTabs] = useState(tabs);

  const showHideClass = (idName) => {
    return tabList.some((item) => {
      return idName === item.id && item.isSelected;
    });
  };

  const selectTab = (idtab) => {
    const newArr = tabList.map((itemD) => {
      if (itemD.id === idtab) {
        itemD.isSelected = true;
        return itemD;
      }
      itemD.isSelected = false;
      return itemD;
    });
    setTabs([...newArr]);
  };

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
      <div>
        <div id={showHideClass('newFile') ? "show" : "hide"}>
          <NewList listNew={listNew} handleNew={handleNew} />
        </div>
        <div id={showHideClass('diffFile') ? "show" : "hide"}>
          <DiffList listDiff={listDiff} handleDiff={handleDiff} />
        </div>
      </div>
    </div>
  );
}
