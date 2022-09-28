import React, { useState, useEffect } from "react";
import { MergelyEditor, ListCard } from "./components";
import { startFileCompare, getStats, getFileData } from "./services";
import io from "socket.io-client";
import "./App.css";
const socket = io();
function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [totalStatus, setTotalStatus] = useState({
    done: 0,
    progress: 0,
  });

  useEffect(() => {
    console.log("isConnected", isConnected);
    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("compare_done", (arg) => {
      if (arg === "done") {
        setTimeout(() => {
          setTotalStatus((preState) => ({
            ...preState,
            done: preState.done + 1,
            progress: (preState.progress && preState.progress - 1) || 0,
          }));
          fetchStats();
        }, 1000);
      } else {
        setTimeout(() => {
          setTotalStatus((preState) => ({
            ...preState,
            progress: preState.progress + 1,
            done: (preState.done && preState.done - 1) || 0,
          }));
        }, 1000);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  const [mergelyShow, setMerglyShow] = useState({
    lhsData: "",
    rhsData: "",
    isShow: false,
  });
  const [formData, setFormData] = useState({
    sourcePath: "",
    targetPath: "",
  });

  const [statsData, setStatsData] = useState({
    diff: 0,
    newF: 0,
    total: 0,
    scan: 0,
  });

  const [listDiff, setListDiff] = useState([]);

  const handleInput = (e) => {
    const val = e.target.value;
    const name = e.target.name;
    setFormData((preState) => ({
      ...preState,
      [name]: val,
    }));
  };
  const handleDiff = (e, spath, tpath, indexKey) => {
    fetchFilesData(spath, tpath).then((resData) => {
      const { data = [] } = resData || {};
      const sData = data.find((datas) => datas.s);
      const tData = data.find((datat) => datat.t);
      // get data before delete
      const newData =
        listDiff.find((dataList) => dataList.pos === indexKey) || {};
      newData.isViewed = true;
      const oldData = JSON.parse(JSON.stringify(listDiff));
      const index = oldData.findIndex((dataL) => dataL.pos === indexKey);
      oldData.splice(index, 1);
      setListDiff([...oldData, newData]);
      setMerglyShow((preState) => {
        return {
          ...preState,
          lhsData: sData.s,
          rhsData: tData.t,
          isShow: true,
        };
      });
    });
  };

  const closeDiff = () => {
    setMerglyShow((preState) => {
      return {
        ...preState,
        lhsData: "",
        rhsData: "",
        isShow: false,
      };
    });
  };

  const startCompare = () => {
    setTotalStatus((preState) => ({
      ...preState,
      progress: 0,
      done: 0,
    }));
    startFileCompare(formData.sourcePath, formData.targetPath);
  };

  const fetchFilesData = async (spath, tpath) => {
    return await getFileData(spath, tpath);
  };

  const fetchStats = () => {
    getStats().then((res) => {
      const dataList = res && res.data && res.data.diffFiles;
      const dataListNew = dataList.map((item, index) => {
        item.pos = index;
        return item;
      });
      setListDiff([...dataListNew]);
      setStatsData((preState) => ({
        ...preState,
        diff: dataList.length,
        newF: (res && res.data && res.data.newFiles.length) || 0,
        scan: (res && res.data && res.data.totalScanFiles) || 0,
      }));
    });
  };

  const handleDiffPos = (pos = "next") => {
    if (window && window.$) {
      window.$("#mergely").mergely("scrollToDiff", pos);
    }
  };

  return (
    <div>
      <div>
        <div style={{ textAlign: "center" }}>
          <h3>Compare XML files quickly</h3>
        </div>
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
          {/* Source */}
          <div
            className="status-pro"
            style={{
              ...((totalStatus.done - 1) > 0 ? { background: "green" } : {}),
              ...((totalStatus.progress - 1) > 0 ? { background: "yellow" } : {}),
            }}
          ></div>
          <div style={{ display: "block" }}>
            <label>Source Path</label> <br />
            <input
              type="text"
              value={formData.sourcePath}
              onChange={handleInput}
              id="source"
              name="sourcePath"
            />
          </div>
          {/* Target */}
          <div style={{ display: "block" }}>
            <label>Target Path</label> <br />
            <input
              type="text"
              value={formData.targetPath}
              onChange={handleInput}
              id="target"
              name="targetPath"
            />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={startCompare}>Start Compare</button>
        </div>
      </div>
      <hr />
      <div>
        <div style={{ display: "flex", margin: 15 }}>
          <div style={{ width: "20%" }}>
            Total Files <span className="badge">{statsData.total}</span>
          </div>
          <div style={{ width: "20%" }}>
            Total Scans <span className="badge">{statsData.scan}</span>
          </div>
          <div style={{ flexGrow: 1, textAlign: "end" }}>
            <button onClick={fetchStats}>Refresh</button>
          </div>
        </div>
        <hr />
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <div>
            Total New <span className="badge">{statsData.newF}</span>
          </div>
          <div>
            Total Diff <span className="badge">{statsData.diff}</span>
          </div>
        </div>
        <hr />
      </div>
      <div style={{ overflowY: "scroll", height: "20rem" }}>
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
            <div className="center_no_data">No compare result......!</div>
          </>
        )}
      </div>
      <div>
        {mergelyShow.isShow && mergelyShow.lhsData && mergelyShow.rhsData && (
          <>
            <div
              style={{
                position: "absolute",
                zIndex: 5,
                top: 0,
                margin: "7px",
                width: "100%",
                background: "white",
              }}
            >
              <div style={{ display: "flex" }}>
                <div style={{ flex: 5 }}>
                  <button onClick={closeDiff}>Close</button>
                </div>
                <div style={{ flex: 1 }}>
                  <button onClick={() => handleDiffPos("next")}>Next</button>
                </div>
                <div style={{ flex: 6 }}>
                  <button onClick={() => handleDiffPos("prev")}>Prev</button>
                </div>
              </div>
            </div>

            <MergelyEditor
              lhsData={mergelyShow.lhsData}
              rhsData={mergelyShow.rhsData}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
