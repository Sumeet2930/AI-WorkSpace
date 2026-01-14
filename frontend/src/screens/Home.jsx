import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

const Home = () => {

    const { user } = useContext(UserContext)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ projectName, setProjectName ] = useState(null)
    const [ project, setProject ] = useState([])
    const [ error, setError ] = useState('')

    const navigate = useNavigate()

    function createProject(e) {
        e.preventDefault()
        console.log({ projectName })

        axios.post('/projects/create', {
            name: projectName,
        })
            .then((res) => {
                console.log(res)
                setIsModalOpen(false)
                setProjectName('')
                setProject(prev => [...prev, res.data])
            })
            .catch((err) => {
                console.log(err)
                if (err.response && err.response.data) {
                    if (err.response.data.errors) {
                         if (Array.isArray(err.response.data.errors)) {
                            setError(err.response.data.errors[0].msg)
                         } else {
                            setError(err.response.data.errors)
                         }
                    } else {
                        setError('Failed to create project')
                    }
                } else {
                     setError('Network Error: Could not connect to server. Check console.')
                }
            })
    }

    useEffect(() => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)

        }).catch(err => {
            console.log(err)
        })

    }, [])

    return (
        <main className='min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300'>
            <header className="p-6 flex justify-between items-center max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    AI Workspace
                </h1>
                <div className="flex items-center gap-4">
                     <ThemeToggle />
                     <div className="user-profile flex items-center gap-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700">
                        <i className="ri-user-smile-line text-xl"></i>
                         <span className="font-medium">{user?.email}</span>
                     </div>
                </div>
            </header>

            <div className="content p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Your Projects</h2>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-200">
                        <i className="ri-add-line text-lg group-hover:rotate-90 transition-transform"></i>
                        New Project
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Create New Project Card */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 dark:bg-slate-800/50 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all duration-200 group h-48">
                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                             <i className="ri-add-line text-2xl text-gray-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400 transition-colors"></i>
                        </div>
                        <span className="text-gray-500 dark:text-slate-400 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Create New Project</span>
                    </button>

                    {project.map((project) => (
                        <div key={project._id}
                            onClick={() => {
                                navigate(`/project?projectId=${project._id}`, {
                                    state: { project }
                                })
                            }}
                            className="group p-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/30 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 h-48 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1'>
                                        {project.name}
                                    </h2>
                                    <i className="ri-arrow-right-up-line text-gray-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"></i>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                    Full stack AI-generated workspace project.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 w-fit px-3 py-1.5 rounded-full mt-4">
                                <i className="ri-group-line text-blue-500"></i>
                                <span>{project.users.length} Collaborators</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all border border-gray-100 dark:border-slate-700">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Create New Project</h2>
                        {error && <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</div>}
                        <form onSubmit={createProject}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Name</label>
                                <input
                                    onChange={(e) => setProjectName(e.target.value)}
                                    value={projectName}
                                    type="text" 
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white placeholder-gray-400" 
                                    placeholder="Enter project name..."
                                    autoFocus
                                    required />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium" 
                                    onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-500/30 transition-all font-medium">
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Home