export type PetAcquisitionEvent = {
    account_id: number;
    profile: string;
    pet_item: number;
    pet_key: string;
    pet_name: string;
    source_type: string;
    source_detail: string | null;
    acquired_at: number;
};
