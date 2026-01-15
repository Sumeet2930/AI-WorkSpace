import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user } = useContext(UserContext)
    const [ loading, setLoading ] = useState(true)
    const token = localStorage.getItem('token')
    const navigate = useNavigate()




    useEffect(() => {
        if (!token) {
            navigate('/login')
            return
        }

        if (user) {
            setLoading(false)
        } else {
            // If we have a token but no user, we might be waiting for user context to load
            // or we might need to fetch the user. For now, let's just wait if token exists.
            // If after a timeout user is still null, then redirect.
            const timeout = setTimeout(() => {
                if (!user) navigate('/login')
            }, 2000)
            return () => clearTimeout(timeout)
        }

    }, [ user, token, navigate ])

    if (loading && !user) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>
    }


    return (
        <>
            {children}</>
    )
}

export default UserAuth