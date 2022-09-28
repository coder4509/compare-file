import React from "react";
import { ListCard } from "../components";

export default function NewList({ listNew = [] , handleNew}) {
  return (
    <div>
      <div style={{ overflowY: "scroll", height: "20rem" }}>
        {listNew.length ? (
          listNew
            .sort((a, b) => {
              return b.pos > a.pos ? 1 : -1;
            })
            .map((dataItem, index) => {
              return (
                <>
                  <ListCard
                    sourcePath={dataItem.s}
                    targetPath={dataItem.t}
                    handleDiff={handleNew}
                    indexKey={index}
                    isViewed={dataItem.isViewed || false}
                    position={dataItem.pos}
                    isNew
                  />
                </>
              );
            })
        ) : (
          <>
            <div className="center_no_data">No New Files......!</div>
          </>
        )}
      </div>
    </div>
  );
}
