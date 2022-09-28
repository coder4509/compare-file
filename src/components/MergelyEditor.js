import React, { useEffect } from "react";

export default function MergelyEditor(props) {
  const { lhsData = "", rhsData = "" } = props;
  useEffect(() => {
    if (window && window.$) {
      window.$("#mergely").mergely();
      window.$("#mergely").mergely("lhs", lhsData);
      window.$("#mergely").mergely("rhs", rhsData);
    }
  }, []);

  return (
    <div>
      <div className="mergely-full-screen-8" style={{top:'75px', background:'beige'}}>
        <div className="mergely-resizer">
          <div id="mergely"></div>
        </div>
      </div>
    </div>
  );
}
