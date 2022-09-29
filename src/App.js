import React, { useState, useEffect } from "react";
import { MergelyEditor, TabView } from "./components";
import { startFileCompare, getStats, getFileData, saveFile } from "./services";
import io from "socket.io-client";
import "./App.css";

const initialState = {
  diff: 0,
  newF: 0,
  total: 0,
  scan: 0,
};

const socket = io();
function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  const [mergelyShow, setMerglyShow] = useState({
    lhsData: "",
    rhsData: "",
    isShow: false,
  });
  const [formData, setFormData] = useState({
    sourcePath: "",
    targetPath: "",
  });

  const [statsData, setStatsData] = useState(initialState);

  const [listDiff, setListDiff] = useState([]);
  const [listNew, setListNew] = useState([]);

  const [startAgain, setStartAgain] = useState(false);

  useEffect(() => {
    console.log("isConnected", isConnected);
    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("save_file", (arg) => {
      console.log("arg", arg);
      if (arg.message === "saved") {
        const cloneListNew = JSON.parse(JSON.stringify(listNew));
        const index = cloneListNew.findIndex(
          (newFile) => newFile.t === arg.path
        );
        if (index !== -1) {
          cloneListNew.splice(index, 1);
          setListNew([...cloneListNew]);
        }
      }
    });

    socket.on("compare_done", (arg) => {
      if (arg === "done") {
        setTimeout(() => {
          fetchStats();
        }, 1000);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

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
    setStatsData((preState) => ({
      ...preState,
      ...initialState,
    }));

    setStartAgain(true);
    startFileCompare(formData.sourcePath, formData.targetPath)
      .then((res) => {
        const { totalFiles = 0 } = res.data;
        setStatsData((preState) => ({
          ...preState,
          total: totalFiles || 0,
        }));
      })
      .catch((err) => {
        setStartAgain(false);
        console.log("Error:UI::startFileCompare", err);
      });
  };

  const fetchFilesData = async (spath, tpath) => {
    return await getFileData(spath, tpath);
  };

  const fetchStats = () => {
    getStats()
      .then((res) => {
        const dataList = res && res.data && res.data.diffFiles;
        const dataListNew = dataList.map((item, index) => {
          item.pos = index;
          return item;
        });
        setListDiff([...dataListNew]);
        if (res && res.data && res.data.newFiles) {
          setListNew([...res.data.newFiles]);
        }
        setStatsData((preState) => ({
          ...preState,
          diff: dataList.length,
          newF: (res && res.data && res.data.newFiles.length) || 0,
          scan: (res && res.data && res.data.totalScanFiles) || 0,
        }));
      })
      .catch((err) => {
        setStartAgain(false);
        console.log("Error:UI::fetchStats", err);
      });
  };

  const handleDiffPos = (pos = "next") => {
    if (window && window.$) {
      window.$("#mergely").mergely("scrollToDiff", pos);
    }
  };

  const handleNewFile = (e, source, target) => {
    console.log("source", source);
    console.log("target", target);
    saveFile(source, target)
      .then((res) => console.log("Response", res))
      .catch((err) => {
        setStartAgain(false);
        console.log("Error:UI::handleNewFile", err);
      });
  };
  const getPer = () => {
    if (statsData.scan > 0 && startAgain) {
      setStartAgain(false);
    }
    return Math.ceil((statsData.scan / statsData.total) * 100);
  };
  return (
    <div>
      <div
        id="overlay"
        style={{
          display:
            (getPer() && getPer() < 100) || startAgain ? "block" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "10px",
          }}
        >
          <button
            onClick={() => {
              setStartAgain(true);
            }}
          >
            Close
          </button>
        </div>
        <div className="wrapper">
          <div className="progress-bar" style={{ textAlign: "-webkit-center" }}>
            <span
              className="progress-bar-fill"
              style={{
                width: `${getPer() || 0}%`,
                textAlign: "center",
                color: "white",
              }}
            >{`${getPer() || 0}%`}</span>
          </div>
        </div>
      </div>
      <div>
        <div style={{ textAlign: "center" }}>
          <h3>Compare XML files quickly</h3>
        </div>
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
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
        <TabView
          handleDiff={handleDiff}
          listDiff={listDiff}
          listNew={listNew}
          handleNew={handleNewFile}
          statsData={statsData}
        />
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
