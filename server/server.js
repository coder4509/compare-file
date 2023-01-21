import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import { detailedDiff } from "deep-object-diff";
import express from "express";
import fileUpload from "express-fileupload";
import {
  readFile,
  existsSync,
  readdir,
  lstat,
  writeFile,
  writeFileSync,
  mkdir,
  readdirSync,
  statSync,
  unlink,
  readFileSync,
  mkdirSync,
  lstatSync,
  openSync,
  createReadStream,
  unlinkSync,
  rmdirSync,
} from "fs";
import { resolve, join } from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import App from "../src/App";
import bodyParser from "body-parser";
import { createServer } from "http";
import * as io from "socket.io";
import transFormXMLFile from "./formatXML";
import uniqid from "uniqid";
import unzipper from "unzipper";

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);

const socketIo = io(httpServer);

app.use(fileUpload());
app.use(express.static("./build"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let newFiles = [];
let diffFiles = [];
let totalScan = [];
const optionsP = {
  allowBooleanAttributes: true,
  format: true,
  suppressBooleanAttributes: false,
  preserveOrder: true,
};
const compareDiff = (spath, tpath) => {
  // Promise for source Data
  totalScan.push(spath);
  const sourceDataPromise = new Promise((resolvePro, rejectPro) => {
    readFile(spath, "utf-8", (err, dataS) => {
      if (err) {
        return rejectPro(new Error(err));
      }
      const sourceParser = new XMLParser({
        ignoreAttributes: false,
        ...optionsP,
      });
      const lhs = sourceParser.parse(dataS);
      resolvePro({ lhs });
    });
  });

  // Promise for Target Data
  const targetDataPromise = new Promise((resolveTPro, rejectTPro) => {
    readFile(tpath, "utf-8", (err, dataT) => {
      if (err) {
        return rejectTPro(new Error(err));
      }
      const sourceParser = new XMLParser({
        ignoreAttributes: false,
        ...optionsP,
      });
      const rhs = sourceParser.parse(dataT);
      resolveTPro({ rhs });
    });
  });

  // Resolve both Promises
  Promise.all([sourceDataPromise, targetDataPromise])
    .then((datas) => {
      const [data1, data2] = datas;
      const { lhs: lhs_1, rhs: rhsD } = data1;
      const { rhs: rhs_1, lhs: lhsD } = data2;
      const { added = {}, deleted = {}, updated = {} } = detailedDiff(
        lhs_1 || lhsD,
        rhs_1 || rhsD
      );
      if (
        Object.keys(added).length ||
        Object.keys(deleted).length ||
        Object.keys(updated).length
      ) {
        diffFiles.push({
          s: spath,
          t: tpath,
        });
      }
    })
    .catch((err) => {
      throw new Error(err);
    });
};

const checkFileDiff = (sPath, tPath, isFirst = false) => {
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
                checkFileDiff(resolve(subSPath), resolve(subTPath));
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
              checkFileDiff(resolve(subSPath), resolve(subTPath));
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              compareDiff(subSPath, subTPath);
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
              checkFileDiff(resolve(subSPath), resolve(subTPath));
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

app.get("/", (req, res) => {
  const app = ReactDOMServer.renderToString(<App />);
  const indexFile = path.resolve("./build/index.html");

  fs.readFile(indexFile, "utf8", (err, data) => {
    if (err) {
      console.error("Something went wrong:", err);
      throw new Error("Something went wrong....!");
    }

    return res.send(
      data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
    );
  });
});

// compare method
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
  }
  ThroughDirectory(folderFilePath)
  return total;
}

const startCompare = (sourcePath, targetPath) => {
  const parentSPath = resolve(sourcePath);
  const parentTPath = resolve(targetPath);
  // first call
  socketIo.emit("compare_done", "progress");
  setTimeout(() => {
    checkFileDiff(parentSPath, parentTPath, true);
    socketIo.emit("compare_done", "done");
  }, 5000);
};

app.post("/xml", async (req, res, next) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const { isFile } = req.query;
    newFiles = [];
    diffFiles = [];
    totalScan = [];
    let totalFiles = 0;
    const filesPath = __dirname + "/files";
    
    if(existsSync(filesPath)) {
      rmdirSync(filesPath, { recursive: true });
    }

    if (isFile === 'true') {
      const fileS = req.files.sourceFile;
      const fileT = req.files.targetFile;
      const fileNameS = fileS.name;
      const fileNameT = fileT.name;
      const filesPath = __dirname + "/files";

      if (!existsSync(filesPath)) {
        mkdirSync(filesPath, { recursive: true });
      }

      await new Promise((re, rj) => {
        fileS.mv(`${filesPath}/${fileNameS}`, (err) => {
          if (err) {
            throw new Error(`Error:: ${fileNameS}`);
          }
          fileT.mv(`${filesPath}/${fileNameT}`, (err) => {
            if (err) {
              throw new Error(`Error:: ${fileNameT}`);
            }
            const files = [
              { type: "S", path: `${filesPath}/${fileNameS}` },
              { type: "T", path: `${filesPath}/${fileNameT}` },
            ];
            let sourcePath = '';
            let targetPath = '';
            files.forEach(({ type, path }) => {
              createReadStream(path)
                .pipe(unzipper.Extract({ path: `${filesPath}/${type}` }))
                .on("error", function(err) {
                  throw new Error(`Error Extract:: ${filesPath}`);
                })
                .on("close", function() {
                  console.log("Done.....");
                  if (type === 'S') {
                    sourcePath = `${filesPath}/${type}`;
                  }
                  if (type === 'T') {
                    targetPath = `${filesPath}/${type}`;
                  }
                  if (sourcePath && targetPath) {
                    console.log(sourcePath, targetPath);
                    totalFiles = checkTotalFiles(sourcePath);
                    startCompare(sourcePath, targetPath);
                    console.log("totalFiles", totalFiles);
                    re('done');
                  }
                });
            });
          });
        });
      })
    } else {
      if (!sourcePath || !targetPath) {
        return res.status(400).send("Please provide paths");
      }
      totalFiles = checkTotalFiles(sourcePath);
      startCompare(sourcePath, targetPath);
    }
    return res
      .status(200)
      .send({ message: "Started ....... !", totalFiles: totalFiles });
  } catch (error) {
    throw new Error(error);
  }
});

app.post("/fileData", async (req, res) => {
  const { source, target } = req.body;
  if (!source || !target) {
    return res.status(400).send("bad request");
  }
  const sourceData = transFormXMLFile(source, "s");
  const targetData = transFormXMLFile(target, "t");
  const responseData = await Promise.all([sourceData, targetData]);
  // =====================
  const [s1, s2] = responseData;
  const sData = s1.s || s2.s;
  const tData = s2.t || s1.t;

  // ===========================
  const targetParser = new XMLParser({
    ignoreAttributes: false,
    ...optionsP,
  });

  const soruceParser = new XMLParser({
    ignoreAttributes: false,
    ...optionsP,
  });
  // ====================================
  const targetDataD = targetParser.parse(tData);
  const sourceDataD = soruceParser.parse(sData);
  const options = { ignoreCase: true, reverse: false, depth: 1, indentSize: 2 };
  const fSData = sourceDataD;
  const fTData = targetDataD;
  // =================================
  const builderTarget = new XMLBuilder({
    ignoreAttributes: false,
    ...optionsP,
  });
  const finalTarget = builderTarget.build(fTData);
  const builderSource = new XMLBuilder({
    ignoreAttributes: false,
    ...optionsP,
  });
  const finalSource = builderSource.build(fSData);

  // create temp file for target
  const taretTempFile = `${uniqid()}_target.xml`;
  writeFileSync(resolve(__dirname, taretTempFile), finalTarget, "utf8");
  const sourceTempFile = `${uniqid()}_source.xml`;
  writeFileSync(resolve(__dirname, sourceTempFile), finalSource, "utf8");

  const finalSourceData = transFormXMLFile(
    resolve(__dirname, sourceTempFile),
    "s"
  );
  const finslTargetData = transFormXMLFile(
    resolve(__dirname, taretTempFile),
    "t"
  );
  const finslresponseData = await Promise.all([
    finalSourceData,
    finslTargetData,
  ]);
  let sourceD = "";
  let targetD = "";
  if (finslresponseData.length) {
    // =====================
    const [s1D, s2D] = responseData;
    sourceD = s1D.s || s2D.s;
    targetD = s2D.t || s1D.t;
    [
      resolve(__dirname, taretTempFile),
      resolve(__dirname, sourceTempFile),
    ].forEach((unlinkPath, index) => {
      unlink(unlinkPath, (err, data) => {
        if (err) {
          console.log("Error: unlink" + index, err);
        }
      });
    });
  }

  return res.send([{ s: sourceD, t: targetD }]);
});

app.get("/stats", (req, res, next) => {
  res.send({
    newFiles,
    diffFiles,
    totalScanFiles: totalScan.length,
  });
});

app.get("/health", (req, res) => {
  res.send("system healthly.....");
});

app.post("/saveFile", (req, res) => {
  try {
    const { target, source } = req.body;
    if (!target) {
      return res.status(400).send({ message: "path is not correct" });
    }
    // Saving File
    const stats = lstatSync(source);
    const isDir = stats.isDirectory();
    if (isDir) {
      mkdirSync(target);
    } else {
      const data = readFileSync(resolve(source), { encoding: "utf-8" });
      writeFileSync(target, data, { encoding: "utf-8" });
    }
    return res.status(200).send({ message: "Saved Successfully" });
  } catch (error) {
    return res.status(500).send({ message: "Somthing went wrong" });
  }
});

app.get("/local/file", (req, res) => {
  const { path } = req.query;
  const data = readFileSync(path, "utf-8");
  return res.send(data);
});

app.post("/xmlFile", (req, res) => {
  const fileS = req.files.sourceFile;
  const fileT = req.files.targetFile;
  const fileNameS = fileS.name;
  const fileNameT = fileT.name;

  console.log("fileS", fileS, fileT);
});
// end

httpServer.listen(port, () => {
  console.log(`listening on *:${port}`);
});

socketIo.on("connection", (socket) => {
  console.log("new client connected");
});
