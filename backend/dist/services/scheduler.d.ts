/**
 * Run the AI demand-prediction algorithm and notify all admins with a summary.
 * Used by the daily scheduled job and can be called manually.
 */
export declare function runScheduledAIAndNotify(): Promise<void>;
export declare function startScheduledAI(): void;
