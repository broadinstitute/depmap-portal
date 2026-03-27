export type CeleryTaskState =
  | "PENDING"
  | "RECEIVED"
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "REVOKED"
  | "REJECTED"
  | "RETRY"
  | "IGNORED"
  | "PROGRESS";

export type CeleryTask = {
  id: string;
  state: CeleryTaskState;
  message: string;
  nextPollDelay?: number;
  percentComplete?: number;
  result: any;
};

export interface PendingCeleryTask extends CeleryTask {
  state: "PENDING";
  message: "";
  percentComplete: undefined;
  result: undefined;
}

export interface ProgressCeleryTask extends CeleryTask {
  state: "PROGRESS";
  result: null;
}

export interface SuccessCeleryTask extends CeleryTask {
  state: "SUCCESS";
}

export interface FailedCeleryTask extends CeleryTask {
  state: "FAILURE";
  percentComplete: undefined;
  result: undefined;
}
