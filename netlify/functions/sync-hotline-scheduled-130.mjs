import { runSyncOnce } from "./_lib.mjs";

export const config = {
  schedule: "30 5 * * 1-5" // 1:30PM Asia/Kuala_Lumpur
};

export default async () => {
  return runSyncOnce({ notifySlack: true, trigger: "scheduled-130pm" });
};
