import React, { useState, useEffect } from "react";

export default function EnvUpdate() {
  const [branch, setBranch] = useState("6000");
  const updateEnvVariables = () => {
    console.log(branch);
  };

  return (
    <div>
      <div>
        <div>Branch</div>
        <div>
          <select
            onSelect={(e, value) => {
              console.log(e);
              console.log(value);
              setBranch(value);
            }}
          >
            <option value="6000" selected={branch === "6000"}>
              6000
            </option>
            <option value="6700" selected={branch === "6700"}>
              6700
            </option>
            <option value="6900" selected={branch === "6900"}>
              6900
            </option>
            <option value="5400" selected={branch === "5400"}>
              5400
            </option>
          </select>
        </div>
      </div>
      <div>
        <button onClick={updateEnvVariables}>Update Variables</button>
      </div>
    </div>
  );
}
