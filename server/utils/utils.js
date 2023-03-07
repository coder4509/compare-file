import { XMLParser } from "fast-xml-parser";
import { detailedDiff } from "deep-object-diff";
import {
  existsSync,
  readdir,
  lstat,
  readdirSync,
  statSync,
  writeFile,
  mkdirSync,
  createWriteStream,
  writeFileSync,
} from "fs";
import { resolve, join, parse } from "path";
import * as Diff from "diff";
import { encode } from "html-entities";
// Local imports
import transFormXMLFile, { createHtmlViewFromText } from "./formatXML";
import localDb, { updateSessionData } from "./localDB";
import moment from "moment";
import axios from "axios";
import unzipper from "unzipper";
import decompress from "decompress";
import { rimraf } from "rimraf";
import os from "os";

const optionsP = {
  allowBooleanAttributes: true,
  format: true,
  suppressBooleanAttributes: false,
  preserveOrder: true,
};

let diffL = 0;
const compareDiff = async (
  spath,
  tpath,
  totalScan = [],
  diffFiles = [],
  newFiles = [],
  totalFiles,
  sessionId,
  clientId
) => {
  totalScan.push(spath);
  updateSessionData({ sessionId, newFiles, diffFiles, totalFiles, totalScan });
  const { ext } = parse(spath);
  // Promise for source Data
  if (ext === ".xml") {
    const sourceData = transFormXMLFile(spath, "s", sessionId);
    const targetData = transFormXMLFile(tpath, "t", sessionId);
    Promise.all([sourceData, targetData])
      .then((responseData) => {
        const [s1, s2] = responseData;
        const sData = s1.s || s2.s;
        const tData = s2.t || s1.t;

        const targetParser = new XMLParser({
          ignoreAttributes: false,
          ...optionsP,
        });

        const soruceParser = new XMLParser({
          ignoreAttributes: false,
          ...optionsP,
        });
        const targetDataD = (tData && targetParser.parse(tData)) || {};
        const sourceDataD = (sData && soruceParser.parse(sData)) || {};

        const { added = {}, deleted = {}, updated = {} } = detailedDiff(
          sourceDataD,
          targetDataD
        );
        const totalDiff =
          Object.keys(added).length +
          Object.keys(deleted).length +
          Object.keys(updated).length;
        if (
          Object.keys(added).length ||
          Object.keys(deleted).length ||
          Object.keys(updated).length
        ) {
          diffL = diffL + 1;
          diffFiles.push({
            s: spath,
            t: tpath,
            diffTotal: totalDiff,
            diffContent: getFileDiffContent({
              spath,
              tpath,
              sData: sData || "",
              tData: tData || "",
            }),
          });
          updateSessionData({
            sessionId,
            newFiles,
            diffFiles,
            totalFiles,
            totalScan,
          });
        }
      })
      .catch((err) => {
        throw new Error(err);
      });
  }
};

const checkFileDiff = (
  sPath,
  tPath,
  isFirst = false,
  totalScan = [],
  newFiles = [],
  diffFiles = [],
  totalFiles,
  sessionId,
  socketIo,
  clientId
) => {
  // check if file or folder exists
  if (clientId) {
    socketIo.emit("compare_done", { clientId, status: "progress" });
  }
  if (!isFirst) {
    totalScan.push(sPath);
    updateSessionData({
      sessionId,
      newFiles,
      diffFiles,
      totalFiles,
      totalScan,
    });
  }
  if (existsSync(sPath) && existsSync(tPath)) {
    readdir(sPath, (err, files) => {
      if (err) {
        throw new Error(err);
      }
      files.forEach((file) => {
        const subSPath = `${sPath}/${file}`;
        const subTPath = `${tPath}/${file}`;
        if (!existsSync(subTPath)) {
          totalScan.push(subSPath);
          updateSessionData({
            sessionId,
            newFiles,
            diffFiles,
            totalFiles,
            totalScan,
          });
          lstat(subSPath, (err2, stats) => {
            if (err2) {
              throw new Error(err2);
            }
            const isDir = stats.isDirectory();
            if (isDir) {
              return setTimeout(() => {
                checkFileDiff(
                  resolve(subSPath),
                  resolve(subTPath),
                  false,
                  totalScan,
                  newFiles,
                  diffFiles,
                  totalFiles,
                  sessionId,
                  socketIo,
                  clientId
                );
                if (clientId) {
                  socketIo.emit("compare_done", { clientId, status: "done" });
                }
              }, 2000);
            }
          });
          newFiles.push({
            s: subSPath,
            t: subTPath,
          });
          updateSessionData({
            sessionId,
            newFiles,
            diffFiles,
            totalFiles,
            totalScan,
          });
          return;
        }
        return lstat(subSPath, (err2, stats) => {
          if (err2) {
            throw new Error(err2);
          }
          const isDir = stats.isDirectory();
          if (isDir) {
            return setTimeout(() => {
              checkFileDiff(
                resolve(subSPath),
                resolve(subTPath),
                false,
                totalScan,
                newFiles,
                diffFiles,
                totalFiles,
                sessionId,
                socketIo,
                clientId
              );
              if (clientId) {
                socketIo.emit("compare_done", { clientId, status: "done" });
              }
            }, 2000);
          } else {
            if (clientId) {
              socketIo.emit("compare_done", { clientId, status: "progress" });
            }
            return setTimeout(() => {
              compareDiff(
                subSPath,
                subTPath,
                totalScan,
                diffFiles,
                newFiles,
                totalFiles,
                sessionId,
                clientId
              );
              if (clientId) {
                socketIo.emit("compare_done", { clientId, status: "done" });
              }
            }, 2000);
          }
        });
      });
    });
  } else {
    if (clientId) {
      socketIo.emit("compare_done", { clientId, status: "done" });
    }
    readdir(sPath, (err, files) => {
      if (err) {
        throw new Error(err);
      }
      files.forEach((file) => {
        const subSPath = `${sPath}/${file}`;
        const subTPath = `${tPath}/${file}`;
        totalScan.push(subSPath);
        updateSessionData({
          sessionId,
          newFiles,
          diffFiles,
          totalFiles,
          totalScan,
        });
        if (!existsSync(subTPath)) {
          updateSessionData({
            sessionId,
            newFiles,
            diffFiles,
            totalFiles,
            totalScan,
          });
          return lstat(subSPath, (err2, stats) => {
            if (err2) {
              throw new Error(err2);
            }
            const isDir = stats.isDirectory();
            if (isDir) {
              if (clientId) {
                socketIo.emit("compare_done", { clientId, status: "progress" });
              }
              newFiles.push({
                s: subSPath,
                t: subTPath,
              });
              return setTimeout(() => {
                checkFileDiff(
                  resolve(subSPath),
                  resolve(subTPath),
                  false,
                  totalScan,
                  newFiles,
                  diffFiles,
                  socketIo,
                  clientId
                );
                if (clientId) {
                  socketIo.emit("compare_done", { clientId, status: "done" });
                }
              }, 2000);
            } else {
              if (clientId) {
                socketIo.emit("compare_done", { clientId, status: "done" });
              }
              newFiles.push({
                s: subSPath,
                t: subTPath,
              });
              updateSessionData({
                sessionId,
                newFiles,
                diffFiles,
                totalFiles,
                totalScan,
              });
              return;
            }
          });
        }
        return lstat(subSPath, (err2, stats) => {
          if (err2) {
            throw new Error(err2);
          }
          const isDir = stats.isDirectory();
          if (isDir) {
            if (clientId) {
              socketIo.emit("compare_done", { clientId, status: "progress" });
            }
            return setTimeout(() => {
              checkFileDiff(
                resolve(subSPath),
                resolve(subTPath),
                false,
                totalScan,
                newFiles,
                diffFiles,
                socketIo,
                clientId
              );
              if (clientId) {
                socketIo.emit("compare_done", { clientId, status: "done" });
              }
            }, 2000);
          } else {
            if (clientId) {
              socketIo.emit("compare_done", { clientId, status: "done" });
            }
            newFiles.push({
              s: subSPath,
              t: subTPath,
            });
            updateSessionData({
              sessionId,
              newFiles,
              diffFiles,
              totalFiles,
              totalScan,
            });
            return;
          }
        });
      });
    });
  }
};

const checkTotalFiles = (folderFilePath) => {
  let total = 0;
  const ThroughDirectory = (Directory) => {
    readdirSync(Directory).forEach((File) => {
      const Absolute = join(Directory, File);
      if (statSync(Absolute).isDirectory()) {
        total++;
        return ThroughDirectory(Absolute);
      } else return total++;
    });
  };
  ThroughDirectory(folderFilePath);
  return total;
};

const startCompare = (
  sourcePath,
  targetPath,
  totalScan = [],
  newFiles = [],
  diffFiles = [],
  totalFiles,
  sessionId,
  socketIo,
  clientId
) => {
  const parentSPath = resolve(sourcePath);
  const parentTPath = resolve(targetPath);
  diffL = 0;
  // first call
  if (clientId) {
    socketIo.emit("compare_done", { clientId, status: "progress" });
  }
  setTimeout(() => {
    checkFileDiff(
      parentSPath,
      parentTPath,
      true,
      totalScan,
      newFiles,
      diffFiles,
      totalFiles,
      sessionId,
      socketIo,
      clientId
    );
    if (clientId) {
      socketIo.emit("compare_done", { clientId, status: "done" });
    }
  }, 5000);
};

const getFileDiffContent = (fileData) => {
  const { spath, tpath, sData, tData } = fileData;
  const diff = Diff.createTwoFilesPatch(
    spath,
    tpath,
    sData,
    tData,
    ">>>source<<<",
    ">>>target<<<"
  );
  return encode(diff);
};

const generateFullReport = ({
  sessionId,
  newFiles,
  diffFiles,
  totalFiles,
  totalScan,
}) => {
  const htmlText = process.env.IS_JENKINS
    ? `<div><a href='http://${os.hostname()}:${
        process.env.PORT
      }/report/${sessionId}'>View Report</a></div>`
    : "";
  let html = `<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
  </head><div style=${process.env.IS_JENKINS ? "" : "text-align: center;"}>
  <h5>XML files difference report.....!</h5>
  ${htmlText}
</div>
<br/>
<hr/>
<div style="text-align:center;">
<table border='1' style="text-align: center;
width: 100%;">
<tr>
<th>Total Files</th>
<th>Total Scans</th>
<th>Total Diff Files</th>
<th>Total New Files</th>
</tr>
<tr>
<td>${totalFiles}</td>
<td>${totalScan.length}</td>
<td>${diffFiles.length}</td>
<td>${newFiles.length}</td>
</tr>
</table>
</div>
<br/>
<br/>
<hr/>`;

  html += `<div style="text-align: center;"><pre style="white-space: pre-wrap;">${encode(
    "=================== New files ========================"
  )}</pre></div><br/><hr/>`;
  if (!newFiles.length) {
    html += `<div style="text-align: center;"><h4>No new files</h4></div>`;
  } else {
    newFiles.forEach((newFile) => {
      const { s, t } = newFile;
      html += `<div><div style="inline-size: min-content;
      overflow-wrap: break-word;
      box-shadow: 1px 1px 2px 2px #ccc;
      border-radius: 5px;border: 1px solid #ccc;
      padding: 10px;width: 95vw">
         <div>
         Source Files => <h4 style='color: green'><pre style="white-space: pre-wrap;">${encode(
           s
         )}</pre></h4>
         </div>
         <div>
         Target Files => <h4 style='color: #dc0909'><pre style="white-space: pre-wrap;">${encode(
           t
         )}</pre></h4>
         </div>
     </div></div>`;
    });
  }

  html += `<br/><hr/>`;

  html += `<div style="text-align: center;"><div><pre style="white-space: pre-wrap;">${encode(
    "=================== Diff files ========================"
  )}</pre></div><br/><hr/></div>
`;

  const allDiffHtml = diffFiles.map(async (diffData) => {
    const { s, t } = diffData;
    const sourceData = transFormXMLFile(s, "s", sessionId);
    const targetData = transFormXMLFile(t, "t", sessionId);
    const responseData = await Promise.all([sourceData, targetData]);
    // =====================
    const [s1, s2] = responseData;
    const sData = s1.s || s2.s;
    const tData = s2.t || s1.t;
    const diff = Diff.createTwoFilesPatch(
      s,
      t,
      sData || "",
      tData || "",
      ">>>source<<<",
      ">>>target<<<"
    );
    return createHtmlViewFromText(encode(diff));
  });

  if (!allDiffHtml.length) {
    html += `<div style="text-align: center;"><h4>No diff files</h4></div>`;
  } else {
    return Promise.all(allDiffHtml)
      .then((values) => {
        values.forEach((text) => {
          html += `<div style="display: flex; align-self: center;"><div style="border: 1px solid #ccc;
      margin: 10px;
      width: 100%;
      padding: 10px;
      inline-size: min-content;
      overflow-wrap: break-word;
      box-shadow: 1px 1px 2px 2px #ccc;
    border-radius: 5px;">
    <pre style="width: 95vw; white-space: pre-wrap;">${text}<pre></div></div>`;
        });
        const mainFolder = resolve(__dirname, "reports");
        !existsSync(mainFolder) && mkdirSync(mainFolder);
        const reportFloder = resolve(
          __dirname,
          mainFolder,
          moment().format("DD-MM-YYYY")
        );
        !existsSync(reportFloder) && mkdirSync(reportFloder);
        console.log(reportFloder);
        // create report html.
        writeFile(
          resolve(__dirname, `${reportFloder}/report_${sessionId}.html`),
          html,
          (err, data) => {
            if (err) throw new Error("Html Error: report file");
          }
        );
      })
      .catch((err) => {
        console.log("html===> error", err);
      });
  }
};

const getLatestContentVersion = async (url) => {
  const versionData = await axios.get(url);
  let version = "";
  if (versionData && versionData.data && versionData.data["dist-tags"]) {
    const { latest } = versionData.data["dist-tags"];
    console.log("Dev version ====>", latest);
    version = latest;
  } else if (versionData && versionData.data) {
    const stringData = versionData.data || "";
    const startIndex = stringData.search("<release>");
    const endIndex = stringData.search("</release>");
    console.log(startIndex, endIndex);
    console.log(
      "version picked ======>",
      stringData.substring(startIndex + 9, endIndex)
    );
    version = stringData.substring(startIndex + 9, endIndex);
  }
  return version;
};

const getJenkinsFilePaths = async ({
  sourceURL,
  targetURL,
  sfileUrl,
  tfileUrl,
  syncPath,
  syncFor,
  sessionId,
}) => {
  // get version
  const sourceVer = await getLatestContentVersion(sourceURL);
  const targetVer = await getLatestContentVersion(targetURL);
  // update the file URL with version
  const sURL = sfileUrl.replaceAll("$version", sourceVer);
  const tURL = tfileUrl.replaceAll("$version", targetVer);
  console.log("sURL====>", sURL);
  console.log("tURL====>", tURL);
  const completeSourceFilePath = sURL;
  const completeTargetFilePath = tURL;
  let html = `<head><meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8" /></head>`;
  if (syncFor === "SS") {
    html += `<div><h4>Report Of <strong>Self Service Prod Content Sync</strong></h4></div><hr/>`;
    html += `<div>Date: ${moment().format("DD-MM-YYYY")}</div>`;
    html += `<div><h5>Latest package version:</h5></div>`;
    html += `<div><ul>
    <li>Production Version:- ${completeSourceFilePath}</li>
    <li>Branch Version:- ${completeTargetFilePath}</li>
    </ul></div><hr/>`;
  }
  if (syncFor === "RT") {
    html += `<div><h4>Report Of <strong>Retail/Telesales</strong> Prod Content Sync</h4></div><hr/>`;
    html += `<div>Date: ${moment().format("DD-MM-YYYY")}</div>`;
    html += `<div><h5>Latest package version:</h5></div>`;
    html += `<div><ul>
    <li>Production Version:- ${completeSourceFilePath}</li>
    <li>Branch Version:- ${completeTargetFilePath}</li>
    </ul></div><hr/>`;
  }
  writeFileSync(resolve(__dirname, `${sessionId}_.html`), html, "utf-8");
  const sFile = await axios({
    method: "get",
    url: completeSourceFilePath,
    responseType: "stream",
  });
  const tFile = await axios({
    method: "get",
    url: completeTargetFilePath,
    responseType: "stream",
  });
  const { base: sourceBase, name: SBaseName } = parse(completeSourceFilePath);
  const { base: targetBase, name: TBaseName } = parse(completeTargetFilePath);

  const sourceP = resolve(__dirname, syncPath, sourceBase);
  const targetP = resolve(__dirname, syncPath, targetBase);

  const extractSP = resolve(__dirname, syncPath, SBaseName);
  const extractTP = resolve(__dirname, syncPath, TBaseName);

  const sourcePromise = new Promise((resS, rejS) => {
    sFile.data
      .pipe(createWriteStream(sourceP))
      .on("error", () => {
        rimraf(sourceP).catch((err) => {
          console.log("Error unlink", sourceBase, "======>", err);
        });
        rejS(false);
        throw new Error(`Error Extract:: ${completeSourceFilePath}`);
      })
      .on("close", () => {
        console.log("Jenkins:: Source Done.....", completeSourceFilePath);
        unzipper.Open.file(sourceP)
          .then((d) => {
            console.log("Source done!", SBaseName);
            d.extract({ path: extractSP });
            rimraf(sourceP).catch((err) => {
              console.log("Error unlink", sourceBase, "======>", err);
            });
            console.log("Error unlink", sourceBase);
            resS(true);
          })
          .catch((err) => {
            rimraf(sourceP).catch((err) => {
              console.log("Error unlink", sourceBase, "======>", err);
            });
            console.log("Error unlink", sourceBase);
            rejS(false);
            throw new Error(
              `Error Extract:: ${completeSourceFilePath} =====> error ${err}`
            );
          });
      });
  });
  const targetPromise = new Promise((tRess, tRej) => {
    tFile.data
      .pipe(createWriteStream(targetP))
      .on("error", () => {
        rimraf(targetP).catch((err) => {
          console.log("Error unlink", targetBase, "======>", err);
        });
        tRej(false);
        throw new Error(`Error Extract:: ${completeTargetFilePath}`);
      })
      .on("close", () => {
        console.log("Jenkins:: Target Done.....", completeTargetFilePath);
        decompress(targetP, extractTP)
          .then((files) => {
            console.log("Target done!", TBaseName);
            rimraf(targetP).catch((err) => {
              console.log("Error unlink", targetBase, "======>", err);
            });
            console.log("Error unlink", targetBase);
            tRess(true);
          })
          .catch((err) => {
            rimraf(targetP).catch((err) => {
              console.log("Error unlink", targetBase, "======>", err);
            });
            console.log("Error unlink", targetBase);
            tRej(false);
            throw new Error(
              `Error Extract:: ${completeTargetFilePath} ======> error ${err}`
            );
          });
      });
  });
  const [s, t] = await Promise.all([sourcePromise, targetPromise]);
  console.log("s::::", s, "t::::", t);
  if (s && t) {
    return {
      s: {
        s,
        spath: extractSP,
      },
      t: {
        t,
        tpath: resolve(
          __dirname,
          syncPath,
          TBaseName,
          "package",
          TBaseName.replaceAll(`-${targetVer}`, "")
        ),
      },
    };
  }
  return null;
};

export {
  compareDiff,
  checkFileDiff,
  checkTotalFiles,
  startCompare,
  getFileDiffContent,
  generateFullReport,
  getLatestContentVersion,
  getJenkinsFilePaths,
};
