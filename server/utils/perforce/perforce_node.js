import { P4 } from "p4api";
import { existsSync, mkdirSync, rmSync } from "fs";
import { resolve, join } from "path";
import { getAllFilesSync } from "get-all-files";

const envConst = process.env;

const { P4PORT, P4USER, P4PASS } = envConst;

const p4 = new P4({
  p4set: {
    P4PORT,
    P4USER,
  },
  binPath: "",
  debug: true,
});

const p4Excute = (cmd, input = "") => {
  let out;
  try {
    out = p4.cmdSync(cmd, input);
  } catch (err) {
    throw new Error(err);
  }

  return out;
};

const p4login = () => {
  const resp = p4Excute(`login`, P4PASS);
  console.log("resp", resp);
  return resp;
};

const createWorkflow = () => {
  p4login();
  const workspace_name = "my_workspace_6000";
  const stream_name = "6000";
  const worksp = resolve(__dirname, workspace_name);
  if (!existsSync(worksp)) {
    mkdirSync(worksp);
  }
  const createClient =
    p4Excute(`client -S //VFIT/${stream_name}-DEXP -o ${workspace_name}`) || {};
  const client = createClient.stat[0];
  client["Root"] = worksp;
  const workspace = p4Excute(`client -i`, client);
  const syncRTContent = p4Excute(
    `-c ${workspace_name} sync -f //VFIT/${stream_name}-DEXP/cust/digitalExpUI_P7/dui-aem-modules/digitalexp-aem-ui-content-rt-l9/digitalexp-aem-ui-content-rt-l9/...`
  );
  const syncSSContent = p4Excute(
    `-c ${workspace_name} sync -f //VFIT/${stream_name}-DEXP/cust/digitalExpUI_P7/dui-aem-modules/digitalexp-aem-ui-content-ss-l9/digitalexp-aem-ui-content-ss-l9/...`
  );
  return { workspace, syncRTContent, syncSSContent };
};

const deleteWorkSpace = () => {
  p4login();
  const workspace_name = "my_workspace_6000";
  if (!workspace_name || typeof workspace_name !== "string") {
    return {};
  }
  const resp = p4Excute(`client -d ${workspace_name}`) || {};
  console.log("resp", resp);
  if (resp && resp.info[0] && resp.info[0].data) {
    const worksp = resolve(__dirname, workspace_name);
    if (existsSync(worksp)) {
      rmSync(worksp, { recursive: true });
    }
  }
  return resp;
};

const createNewSwarm = () => {
  p4login();
  const workspace_name = "my_workspace_6000";
  const stream_name = "6000";

  const worksp = resolve(__dirname, workspace_name);
  const files = getAllFilesSync(worksp);
  console.log(files, "files");
  const fileToAdd = files.toArray().filter((val) => {
    return val.includes(".content2");
  });
  console.log(fileToAdd, "fileToAdd");
  const getPathIndex = resolve(fileToAdd[0]).search(`cust`);
  const filePath = fileToAdd[0].substring(getPathIndex, fileToAdd[0].length);
  const finalPath = join(`//VFIT/${stream_name}-DEXP/`, filePath)
    .replace(/\\/g, "/")
    .replace("/VFIT", "//VFIT");

  console.log("finalPath", finalPath);
  const createNewCheckList = p4Excute(`-c ${workspace_name} change -o`);
  const { stat = [] } = createNewCheckList || {};
  const checkListSpec = stat[0];
  checkListSpec.Description = "(Auto generate) Production content sync new Files #review";
  const step1 = p4Excute(`-c ${workspace_name} change -i`, checkListSpec);
  const { info } = step1;
  const checkList = info[0] && info[0].data && info[0].data.match(/[0-9]+/g);
  console.log("checkList[0]", checkList[0]);

  const step2 = p4Excute(
    `-c ${workspace_name} add -c ${checkList[0]} ${finalPath}`
  );
  const revertUnchanged = p4Excute(`-c ${workspace_name} revert -a`);
  const step3 = p4Excute(`-c ${workspace_name} shelve -c ${checkList[0]}`);

  return { createNewCheckList, step1, step2, revertUnchanged, step3 };
};

const reverCheckList = (numnerCl) => {
  const workspace_name = "my_workspace_6000";
  const stream_name = "6000";
  console.log(numnerCl);
  const revert = p4Excute(`-c ${workspace_name} revert -c ${numnerCl} //...`);
  const unshelveFiles = p4Excute(
    `-c ${workspace_name} unshelve -s ${numnerCl} -c default -f //...`
  );
  const deleteShelve = p4Excute(`-c ${workspace_name} shelve -d -c ${numnerCl}`);
  const opened = p4Excute(`-c ${workspace_name} opened`);
  const deleteCL = p4Excute(`-c ${workspace_name} change -d ${numnerCl}`);
  return { revert, unshelveFiles, opened, deleteShelve,  deleteCL };
};

const getPendingList = () => {
  const workspace_name = "my_workspace_6000";
  const listp = p4Excute(`changes -s pending -c ${workspace_name}`);
  return listp;
};

export {
  p4login,
  createNewSwarm,
  createWorkflow,
  deleteWorkSpace,
  reverCheckList,
  getPendingList,
};
