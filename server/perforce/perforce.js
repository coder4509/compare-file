import { P4 } from "p4api";

const p4 = new P4({ p4set: { P4PORT: "", P4CHARSET: "utf8",
P4API_TIMEOUT: 10000 } });

const clinetName = "vfitperforce:1666";
p4.setOpts({ env: { P4PORT: clinetName } });
p4.addOpts({ env: { P4USER: 'shrirako' } });
const perForceLogin = ({ client = clinetName, username, password }) => {
  p4.setOpts({ env: { P4PORT: client } });
  p4.addOpts({ env: { P4USER: username } });
  try {
    const out = p4.cmdSync("login", password);
    return out;
  } catch (err) {
    throw "p4 not found";
  }
};

const perForceLogout = () => {
  try {
    const out = p4.cmdSync("logout");
    return out;
  } catch (err) {
    throw "p4 not found";
  }
};

const getWorkSpaces = () => {
  try {
    const out = p4.cmdSync('clients -t --me');
    return out;
  } catch (error) {
    console.log(error);
    throw "p4 not found";
  }
};

const switchWorkSpace = (workspacename) => {
  try {
    console.log("workspacename", workspacename);
    const out = p4.cmdSync(`client -s ${workspacename}`);
    return out;
  } catch (error) {
    throw "p4 not found";
  }
};

const getFileHistory = (filePath) => {
    try {
        const out = p4.cmdSync('filelog', `${filePath}`);
        return out
    } catch (error) {
        throw "p4 not found";
    }
}

export {
  getWorkSpaces,
  perForceLogin,
  perForceLogout,
  switchWorkSpace,
  getFileHistory
};
