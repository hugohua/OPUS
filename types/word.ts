export interface Collocation {
    text: string;     // e.g. "sign a contract"
    translation?: string;
}

export interface WordAsset {
    id: number;
    word: string;
    phonetic?: string;
    meaning: string;
    word_family?: Record<string, string>;
    collocations: Collocation[];
    scenarios?: string[]; // e.g. ["Legal", "Contract"]
}
