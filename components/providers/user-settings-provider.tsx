'use client';

import React, { createContext, useContext } from 'react';
import type { UserSettings } from '@/actions/update-user-settings';

const UserSettingsContext = createContext<UserSettings>({ autoPlay: true, hapticFeedback: false });

export function UserSettingsProvider({ settings, children }: { settings: UserSettings, children: React.ReactNode }) {
    return (
        <UserSettingsContext.Provider value={settings}>
            {children}
        </UserSettingsContext.Provider>
    );
}

export function useSharedUserSettings() {
    return useContext(UserSettingsContext);
}
