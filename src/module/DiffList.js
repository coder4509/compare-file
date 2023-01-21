import React from "react";
import { ListCard } from "../components";

export default function DiffList({listDiff = [], handleDiff}) {
  return (
    <div>
      <div style={{ overflowY: "scroll" }}>
        {listDiff.length ? (
          listDiff
            .sort((a, b) => {
              return b.pos > a.pos ? 1 : -1;
            })
            .map((dataItem, index) => {
              return (
                <>
                  <ListCard
                    sourcePath={dataItem.s}
                    targetPath={dataItem.t}
                    handleDiff={handleDiff}
                    indexKey={index}
                    isViewed={dataItem.isViewed || false}
                    position={dataItem.pos}
                  />
                </>
              );
            })
        ) : (
          <>
            <div className="center_no_data">No Diff Files......!</div>
          </>
        )}
      </div>
    </div>
  );
}
