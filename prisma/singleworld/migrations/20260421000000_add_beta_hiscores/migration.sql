CREATE TABLE "beta_hiscore" (
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL DEFAULT 'main',
    "type" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profile", "type", "account_id")
);

CREATE TABLE "beta_hiscore_large" (
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL DEFAULT 'main',
    "type" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "value" BIGINT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profile", "type", "account_id")
);
