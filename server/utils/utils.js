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
} from "fs";
import { resolve, join, parse } from "path";
import * as Diff from "diff";
import { encode } from "html-entities";
// Local imports
import transFormXMLFile, { createHtmlViewFromText } from "./formatXML";

const optionsP = {
  allowBooleanAttributes: true,
  format: true,
  suppressBooleanAttributes: false,
  preserveOrder: true,
};

const compareDiff = async (spath, tpath, totalScan = [], diffFiles = []) => {
  totalScan.push(spath);
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
          diffFiles.push({
            s: spath,
            t: tpath,
            diffTotal: totalDiff,
            diffContent: getFileDiffContent({
              spath,
              tpath,
              sData: sData || '',
              tData: tData || '',
            }),
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
  socketIo
) => {
  // check if file or folder exists
  socketIo.emit("compare_done", "progress");
  if (!isFirst) {
    totalScan.push(sPath);
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
                  socketIo
                );
                socketIo.emit("compare_done", "done");
              }, 2000);
            }
          });
          return newFiles.push({
            s: subSPath,
            t: subTPath,
          });
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
                socketIo
              );
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              compareDiff(subSPath, subTPath, totalScan, diffFiles);
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
        if (!existsSync(subTPath)) {
          return newFiles.push({
            s: subSPath,
            t: subTPath,
          });
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
            return newFiles.push({
              s: subSPath,
              t: subTPath,
            });
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
  socketIo
) => {
  const parentSPath = resolve(sourcePath);
  const parentTPath = resolve(targetPath);
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
    "source_",
    "target_"
  );
  createHtmlViewFromText(encode(diff)).then((fileD)=>{
    appendFileSync(
      resolve(__dirname, "overview.html"),
      `<div style="border-top: 1px solid #ccc;
      margin: 10px;
      width: 100%;
      padding: 10px;"><pre>${fileD}<pre></div>`,
      "utf-8"
    );
  });
  return encode(diff);
};

export {
  compareDiff,
  checkFileDiff,
  checkTotalFiles,
  startCompare,
  getFileDiffContent,
};
