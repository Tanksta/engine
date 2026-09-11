CREATE TABLE IF NOT EXISTS "npc_killcount" (
  "account_id" INTEGER NOT NULL,
  "profile" TEXT NOT NULL DEFAULT 'main',
  "npc_type" INTEGER NOT NULL,
  "npc_name" TEXT NOT NULL,
  "kills" INTEGER NOT NULL DEFAULT 0,
  "last_kill" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("account_id", "profile", "npc_type")
);

CREATE INDEX IF NOT EXISTS "npc_killcount_npc_type_idx" ON "npc_killcount"("npc_type");
