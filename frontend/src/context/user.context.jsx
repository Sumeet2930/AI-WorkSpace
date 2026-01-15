import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [ user, setUser ] = useState(null);
    const [ loading, setLoading ] = useState(!!localStorage.getItem('token'));

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            axios.get('/users/profile')
                .then(res => {
                    setUser(res.data.user);
                })
                .catch(err => {
                    console.error('Failed to fetch user profile:', err);
                    localStorage.removeItem('token'); // Clear invalid token
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};


