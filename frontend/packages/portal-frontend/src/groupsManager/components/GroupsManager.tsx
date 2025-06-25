import "src/public-path";
import * as React from "react";
import { breadboxAPI } from "@depmap/api";
import { useEffect, useState } from "react";
import GroupsPage from "@depmap/groups-manager";

export default function GroupsManager() {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const currentUser = await breadboxAPI.getBreadboxUser();
      setUser(currentUser);
    })();
  }, []);

  return (
    <div>
      {user && (
        <GroupsPage
          user={user}
          getGroups={breadboxAPI.getGroups}
          addGroup={breadboxAPI.postGroup}
          deleteGroup={breadboxAPI.deleteGroup}
          addGroupEntry={breadboxAPI.postGroupEntry}
          deleteGroupEntry={breadboxAPI.deleteGroupEntry}
        />
      )}
    </div>
  );
}
