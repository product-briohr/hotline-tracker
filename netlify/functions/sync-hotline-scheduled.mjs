import { runSyncOnce } from "./_lib.mjs";

export const config = {
  schedule: "0 5 * * 1-5" // 1PM Asia/Kuala_Lumpur
};

export default async () => {
  return runSyncOnce();
};
