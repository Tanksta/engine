CREATE TABLE `pet_acquisition` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `account_id` INTEGER NOT NULL,
  `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
  `pet_item` INTEGER NOT NULL,
  `pet_key` VARCHAR(191) NOT NULL,
  `pet_name` VARCHAR(191) NOT NULL,
  `source_type` VARCHAR(191) NOT NULL,
  `source_detail` VARCHAR(191) NULL,
  `acquired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `pet_acquisition_account_id_profile_idx`(`account_id`, `profile`),
  INDEX `pet_acquisition_pet_item_idx`(`pet_item`),
  INDEX `pet_acquisition_pet_key_idx`(`pet_key`),
  INDEX `pet_acquisition_source_type_idx`(`source_type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
