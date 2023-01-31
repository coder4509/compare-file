import { createReadStream } from "fs";
import { createInterface } from "readline";

async function processLineByLine(data, type) {
  const fileLineText = {
    [type]: [],
  };
  let i = 0;
  const fileStream = createReadStream(data);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    fileLineText[type].push({ line: i, text: line, type });
    i++;
  }
  return fileLineText;
}

const getDiffOverView = async (sourcePath, targetPath) => {
  const overViewData = await Promise.all([
    processLineByLine(resolve(__dirname, sourcePath), "sourceFile"),
    processLineByLine(resolve(__dirname, targetPath), "targetFile"),
  ]);
  const [sourceFileData, targetFileData] = overViewData;
  const { sourceFile } = sourceFileData;
  const { targetFile } = targetFileData;
  let loopWithData = targetFile;
  let loopForData;
  let cType = "s";
  if (sourceFile.length >= targetFile.length) {
    loopData = sourceFile;
  } else {
    loopWithData = sourceFile;
    loopData = targetFile;
    cType = "t";
  }

  const overViewFile = [];
  loopForData.forEach((itemData) => {
    const { line, text } = itemData;
    const data = loopWithData.find((dataLItem) => {
      const { line: lineNumber } = dataLItem;
      return lineNumber === line;
    });
    const { text: tText } = data;
    if (text !== tText) {
      overViewFile.push({ [cType]: data, ...itemData });
    }
  });

  return overViewFile;
};

export default getDiffOverView;
