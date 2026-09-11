CREATE TABLE IF NOT EXISTS `npc_killcount` (
  `account_id` INT NOT NULL,
  `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
  `npc_type` INT NOT NULL,
  `npc_name` VARCHAR(191) NOT NULL,
  `kills` INT NOT NULL DEFAULT 0,
  `last_kill` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`account_id`, `profile`, `npc_type`),
  INDEX `npc_killcount_npc_type_idx`(`npc_type`)
);
