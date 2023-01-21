import React, { useState, useEffect } from "react";
import { MergelyEditor, TabView, FileUpload } from "./components";
import { startFileCompare, getStats, getFileData, saveFile } from "./services";
import io from "socket.io-client";
import { DiffList, NewList } from "./module";
import "./App.css";

const initialState = {
  diff: 0,
  newF: 0,
  total: 0,
  scan: 0,
};

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
  const [tabList, setTabs] = useState(tabs);

  const [statsData, setStatsData] = useState(initialState);

  const [listDiff, setListDiff] = useState([]);
  const [listNew, setListNew] = useState([]);

  const [startAgain, setStartAgain] = useState(false);

  const [fileS, setFileS] = useState();
  const [fileT, setFileT] = useState();
  const [fileNameS, setFileNameS] = useState("");
  const [fileNameT, setFileNameT] = useState("");
  const [isFile, setIsFile] = useState(false);

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
    if (isFile) {
      if (!fileNameS || !fileNameT) {
        setStartAgain(false);
        return alert("please upload source & target files");
      }
      const formFileData = new FormData();
      formFileData.append("sourceFile", fileS);
      formFileData.append("targetFile", fileT);
      formFileData.append("sourcefileName", fileNameS);
      formFileData.append("targetfileName", fileNameT);
      startFileCompare({ isFile, formFileData })
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
    } else {
      setFileNameS("");
      setFileNameT("");
      setFileS(null);
      setFileT(null);
      startFileCompare({
        spath: formData.sourcePath,
        tpath: formData.targetPath,
      })
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
    }
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
    saveFile(source, target)
      .then((res) => {
        if (res.status === 200) {
          alert("file saved");
        }
      })
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

  // Mergely search
  const searchText = (textToSearch = "") => {
    if (window && window.$) {
      window.$("#mergely").mergely("search", "lhs", textToSearch);
      window.$("#mergely").mergely("search", "rhs", textToSearch);
    }
  };

  const showHideClass = (idName) => {
    return tabList.some((item) => {
      return idName === item.id && item.isSelected;
    });
  };

  function handleRadioClick(e) {
    const { value } = e.target;
    if (value === "FILE") {
      return setIsFile(true);
    }
    return setIsFile(false);
  }

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
              setStartAgain(false);
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
      <div className="main-section-header">
        {/* 1 section */}
        <div>
          <div style={{ textAlign: "center" }}>
            <h3>Compare & Sort XML</h3>
          </div>
          <div className="select-compare-type">
            <div>
              <input
                type="radio"
                id="path"
                name="compare_type"
                value="PATH"
                onClick={handleRadioClick}
              />
              <label for="path">PATH</label>
            </div>
            <div>
              <input
                type="radio"
                id="file"
                name="compare_type"
                value="FILE"
                onClick={handleRadioClick}
              />
              <label for="file">FILE</label>
            </div>
          </div>
          {!isFile && (
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
          )}
          {isFile && (
            <FileUpload
              setFileS={setFileS}
              setFileNameS={setFileNameS}
              setFileT={setFileT}
              setFileNameT={setFileNameT}
            />
          )}
          <div style={{ textAlign: "center" }}>
            <button onClick={startCompare}>Start Compare</button>
          </div>
        </div>
        <hr />
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
        <div>
          <TabView
            statsData={statsData}
            selectTab={selectTab}
            tabList={tabList}
          />
        </div>
      </div>
      <div
        style={{
          position: "inherit",
          marginTop: "26rem",
        }}
      >
        <div id={showHideClass("newFile") ? "show" : "hide"}>
          <NewList listNew={listNew} handleNew={handleNewFile} />
        </div>
        <div id={showHideClass("diffFile") ? "show" : "hide"}>
          <DiffList listDiff={listDiff} handleDiff={handleDiff} />
        </div>
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
                background: "#ddd",
              }}
            >
              <div style={{ display: "flex", marginBottom: "1rem" }}>
                <div
                  style={{ flex: 1, display: "flex" }}
                  className="mergly-Handler"
                >
                  <button onClick={() => handleDiffPos("next")}>Next</button>
                  <button onClick={() => handleDiffPos("prev")}>Prev</button>
                  <div>
                    <input
                      type="search"
                      className="merglySearch"
                      onChange={(e) => {
                        const value = e.target.value;
                        searchText(value);
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "end", marginRight: "2rem" }}>
                  <button onClick={closeDiff}>Close</button>
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
