import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user, loading } = useContext(UserContext)
    const navigate = useNavigate()

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login')
            }
        }
    }, [user, loading, navigate])

    if (loading) {
        return <div>Loading...</div>
    }

    return (
        <>{children}</>
    )
}

export default UserAuth