import { XMLParser } from "fast-xml-parser";
import { detailedDiff } from "deep-object-diff";
import {
  existsSync,
  readdir,
  lstat,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  writeFile,
} from "fs";
import { resolve, join, parse } from "path";
import * as Diff from "diff";
import { encode } from "html-entities";
// Local imports
import transFormXMLFile, { createHtmlViewFromText } from "./formatXML";
import localDb, { updateSessionData } from "./localDB";

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
  sessionId
) => {
  totalScan.push(spath);
  updateSessionData({ sessionId, newFiles, diffFiles, totalFiles, totalScan });
  const { ext } = parse(spath);
  // Promise for source Data
  if (ext === ".xml") {
    const sourceData = transFormXMLFile(spath, "s");
    const targetData = transFormXMLFile(tpath, "t");
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
  socketIo
) => {
  // check if file or folder exists
  socketIo.emit("compare_done", "progress");
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
                  socketIo
                );
                socketIo.emit("compare_done", "done");
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
                socketIo
              );
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              compareDiff(
                subSPath,
                subTPath,
                totalScan,
                diffFiles,
                newFiles,
                totalFiles,
                sessionId
              );
              socketIo.emit("compare_done", "done");
            }, 2000);
          }
        });
      });
    });
  } else {
    socketIo.emit("compare_done", "done");
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
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              checkFileDiff(
                resolve(subSPath),
                resolve(subTPath),
                false,
                totalScan,
                newFiles,
                diffFiles,
                socketIo
              );
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "done");
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
  socketIo
) => {
  const parentSPath = resolve(sourcePath);
  const parentTPath = resolve(targetPath);
  diffL = 0;
  // first call
  socketIo.emit("compare_done", "progress");
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
      socketIo
    );
    socketIo.emit("compare_done", "done");
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
  let html = `<div style="text-align: center;">
  <h1>XML files difference report.....!</h1>
</div>
<br/>
<hr/>
<table border='1'>
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
<br/>
<br/>
<hr/>
<div style="text-align: center;"><div><pre>${encode(
    "<<<<<<=================== Diff files ========================<<<<<<"
  )}</pre></div><br/><hr/></div>
`;

  const allDiffHtml = diffFiles.map(async (diffData) => {
    const { s, t } = diffData;
    const sourceData = transFormXMLFile(s, "s");
    const targetData = transFormXMLFile(t, "t");
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
  return Promise.all(allDiffHtml)
    .then((values) => {
      values.forEach((text) => {
        html += `<div style="border-top: 1px solid #ccc;
    margin: 10px;
    width: 100%;
    padding: 10px;"><pre>${text}<pre></div>`;
      });

      html += `<div style="text-align: center;"><pre>${encode(
        "<<<<<<=================== New files ========================<<<<<<"
      )}</pre></div><br/>`;
      if (!newFiles.length) {
        html += `<div style="text-align: center;"><h4>No new files</h4></div>`
      } else {

        newFiles.forEach((newFile) => {
          const { s, t } = newFile;
          html += `<div>
               <div>
               Source:==> <h4><pre>${encode(s)}</pre></h4>
               </div>
               <div>
               <p><b>source file not exists at below Target location</b></p>
               Target:==> <h4><pre>${encode(t)}</pre></h4>
               </div>
           </div>`;
        });
      }

      // create report html.
      writeFile(
        resolve(__dirname, `report_${sessionId}.html`),
        html,
        (err, data) => {
          if (err) throw new Error("Html Error: report file");
        }
      );
    })
    .catch((err) => {
      console.log("html===> error", err);
    });
};

export {
  compareDiff,
  checkFileDiff,
  checkTotalFiles,
  startCompare,
  getFileDiffContent,
  generateFullReport,
};