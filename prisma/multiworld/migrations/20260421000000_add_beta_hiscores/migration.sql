CREATE TABLE `beta_hiscore` (
  `account_id` int NOT NULL,
  `profile` varchar(191) NOT NULL DEFAULT 'main',
  `type` int NOT NULL,
  `level` int NOT NULL,
  `value` int NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`profile`,`type`,`account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `beta_hiscore_large` (
  `account_id` int NOT NULL,
  `profile` varchar(191) NOT NULL DEFAULT 'main',
  `type` int NOT NULL,
  `level` int NOT NULL,
  `value` bigint NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`profile`,`type`,`account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
