'use client';

import React, { createContext, useContext } from 'react';
import type { UserSettings } from '@/actions/update-user-settings';

const defaultSettings: UserSettings = { autoPlay: true, hapticFeedback: false };
const UserSettingsContext = createContext<UserSettings>(defaultSettings);

export function UserSettingsProvider({ settings, children }: { settings: UserSettings, children: React.ReactNode }) {
    const mergedSettings = { ...defaultSettings, ...settings };

    return (
        <UserSettingsContext.Provider value={mergedSettings}>
            {children}
        </UserSettingsContext.Provider>
    );
}

export function useSharedUserSettings() {
    return useContext(UserSettingsContext);
}
