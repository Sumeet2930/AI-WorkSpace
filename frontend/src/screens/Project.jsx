import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer'
import ThemeToggle from '../components/ThemeToggle'

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set())
    const [ project, setProject ] = useState(location.state?.project || {})
    const [ message, setMessage ] = useState('')
    const [ user, setUser ] = useState(useContext(UserContext).user)
    const [ error, setError ] = useState('')
    const messageBox = useRef(null)
    
    // UI State for tabs/panels
    const [ activeTab, setActiveTab ] = useState('editor') // 'editor' | 'preview'

    useEffect(() => {
        const projectId = location.state?.project?._id || new URLSearchParams(location.search).get('projectId')
        if (!projectId) {
            navigate('/')
        }
    }, [location.state, location.search, navigate])

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([]) 
    const [ fileTree, setFileTree ] = useState({})
    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])
    const [ webContainer, setWebContainer ] = useState(null)
    const webContainerRef = useRef(null)
    const [ iframeUrl, setIframeUrl ] = useState(null)
    const [ runProcess, setRunProcess ] = useState(null)
    const [ isRunning, setIsRunning ] = useState(false)
    const [ buildLogs, setBuildLogs ] = useState('')
    const [ latestAiResponse, setLatestAiResponse ] = useState(null)



    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const newSet = new Set(prev);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            return newSet;
        });
    }

    function addCollaborators() {
        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            setIsModalOpen(false)
            setProject(res.data.project)
             setSelectedUserId(new Set())
        }).catch(err => {
            console.log(err)
             if (err.response && err.response.data) {
                setError(err.response.data.errors ? (Array.isArray(err.response.data.errors) ? err.response.data.errors[0].msg : err.response.data.errors) : 'Failed to add collaborators')
            } else {
                 setError('Network Error')
            }
        })
    }

    const send = () => {
         if (!message || !message.trim()) return
         const ok = sendMessage('project-message', {
             message,
             sender: user
         })
         if (ok) setMessage("")
    }

    function WriteAiMessage(message) {
        let messageObject = message
        if (typeof message === 'string') {
            try {
                const cleaned = message.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
                messageObject = JSON.parse(cleaned)
            } catch (e) {
                messageObject = { text: message }
            }
        }
        
        // Basic normalization if it's an array or missing text
        let text = ''
        if (messageObject && typeof messageObject === 'object') {
            if (Array.isArray(messageObject)) {
                text = "I have generated some files for you. Check the file explorer."
            } else {
                text = messageObject.text || messageObject.message || JSON.stringify(messageObject)
            }
        } else {
            text = String(messageObject)
        }

        return (
            <div className='overflow-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-3 shadow-sm'>
                <div className="prose dark:prose-invert max-w-none text-sm">
                    <Markdown children={text} options={{ overrides: { code: SyntaxHighlightedCode } }} />
                </div>
            </div>)
    }

    useEffect(() => {
        const projectIdFromState = location.state?.project?._id
        const projectIdFromQuery = new URLSearchParams(location.search).get('projectId')
        const projectId = projectIdFromState || projectIdFromQuery
        
        if (!projectId) return

        const socket = initializeSocket(projectId)
        
        if (!webContainerRef.current) {
            getWebContainer().then(container => {
                webContainerRef.current = container
                setWebContainer(container)
            })
        }

        const handler = (data) => {
            if (data.sender && data.sender._id == 'ai') {
                let parsedMessage = null
                try {
                    const msgStr = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
                    const cleaned = msgStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
                    parsedMessage = JSON.parse(cleaned)
                    
                    // Normalize if AI sent an array of objects (as seen in some versions)
                    if (Array.isArray(parsedMessage)) {
                        const tree = {}
                        parsedMessage.forEach(fileObj => {
                            if (fileObj.fileName && fileObj.code) {
                                tree[fileObj.fileName] = { file: { contents: fileObj.code } }
                            }
                        })
                        parsedMessage = {
                            text: "I have generated the files as requested.",
                            fileTree: tree
                        }
                    }
                } catch (err) {
                    parsedMessage = { text: typeof data.message === 'object' ? JSON.stringify(data.message) : String(data.message) }
                }
                
                if (parsedMessage.fileTree) {
                    setFileTree(prev => ({ ...prev, ...parsedMessage.fileTree }))
                    webContainerRef.current?.mount(parsedMessage.fileTree).catch(e => console.error('Mount failed:', e))
                }
                
                if (parsedMessage.buildCommand || parsedMessage.startCommand) {
                    setLatestAiResponse(parsedMessage)
                }
                
                setMessages(prev => [ ...prev, { ...data, message: parsedMessage } ])
            } else {
                setMessages(prev => [ ...prev, data ])
            }
        }

        socket.on('project-message', handler)

        // Fetch project if needed or if refresh
        axios.get(`/projects/get-project/${projectId}`).then(res => {
            if (res.data.project) {
                setProject(res.data.project)
                setFileTree(res.data.project.fileTree || {})
                
                const msgs = (res.data.project.messages || []).map(m => {
                    const sender = m.sender || null
                    let normSender = null
                    if (sender) {
                        if (typeof sender === 'string') normSender = { _id: sender, email: sender }
                        else if (typeof sender === 'object') normSender = { _id: sender._id || sender, email: sender.email || String(sender._id || '') }
                    }
                    
                    let normMessage = m.message
                    if (normSender && normSender._id === 'ai') {
                        try {
                            const cleaned = String(m.message).replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
                            normMessage = JSON.parse(cleaned)
                        } catch (e) { }
                    }
                    return { ...m, sender: normSender, message: normMessage }
                })
                setMessages(msgs)
            }
        }).catch(err => {
            console.error('Failed to load project:', err)
            setError('Failed to load project details.')
        })

        axios.get('/users/all').then(res => setUsers(res.data.users))
        return () => { socket.off('project-message', handler) }
    }, [location.state, location.search])

    function saveFileTree(ft) {
        if (!project?._id) return
        axios.put('/projects/update-file-tree', { projectId: project._id, fileTree: ft })
    }

    useEffect(() => {
        if(messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }, [messages])

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-50 dark:bg-slate-900 transition-colors">
                <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 max-w-md text-center animate-fadeIn">
                    <i className="ri-error-warning-line text-6xl text-red-500 mb-4 block animate-bounce"></i>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Project Not Found</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/')}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium shadow-lg shadow-blue-500/20 hover:scale-105">
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <main className='h-screen w-screen flex bg-gray-50 dark:bg-slate-900 overflow-hidden transition-colors duration-300'>
            {/* Left Sidebar - Chat & Tools */}
            <section className="left relative flex flex-col h-full w-[350px] min-w-[300px] bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-xl z-10 transition-colors">
                
                {/* Header */}
                <header className='flex justify-between items-center p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700'>
                    <div className="flex items-center gap-2">
                        <h1 className='font-bold text-gray-800 dark:text-white truncate max-w-[100px]' title={project?.name || 'Loading...'}>{project?.name || 'Project'}</h1>
                        <button className='flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors' onClick={() => setIsModalOpen(true)}>
                            <i className="ri-user-add-line"></i>
                            <span className="text-[10px] font-semibold uppercase">Add</span>
                        </button>
                        <ThemeToggle />
                    </div>
                    
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors'>
                        <i className={`ri-side-bar-fill text-xl ${isSidePanelOpen ? 'text-blue-600 dark:text-blue-400' : ''}`}></i>
                    </button>
                </header>

                {/* Chat Area */}
                <div className="conversation-area flex-grow flex flex-col h-full overflow-hidden relative">
                    <div ref={messageBox} className="message-box p-4 flex-grow flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                        {messages.map((msg, index) => {
                            const sender = msg.sender || { _id: 'ai', email: 'AI' };
                            const isAi = sender._id === 'ai';
                            const currentUserId = user?._id ? String(user._id) : null
                            const senderIdStr = sender && sender._id ? (sender._id.toString ? sender._id.toString() : String(sender._id)) : null
                            const isCurrentUser = currentUserId && senderIdStr && currentUserId === senderIdStr

                            return (
                                <div key={index} className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} animate-fadeIn`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <small className='text-xs text-gray-400 dark:text-gray-500 font-medium'>{isAi ? '✨ AI Assistant' : (isCurrentUser ? 'You' : sender.email)}</small>
                                    </div>
                                    <div className={`${isAi ? 'w-full' : 'max-w-[85%]'} text-sm`}>
                                        {isAi ? WriteAiMessage(msg.message) : (
                                            <div className={`p-3 px-4 rounded-2xl ${
                                                isCurrentUser 
                                                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/20' 
                                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
                                            }`}>
                                                {msg.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Input Area */}
                    <div className="inputField p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                        <div className="relative flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                            <input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && message.trim()) {
                                        send()
                                    }
                                }}
                                className='w-full p-3 pl-4 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400' 
                                type="text" 
                                placeholder='Type a message or ask AI...' />
                            <button
                                onClick={send}
                                className={`p-2 mr-1 rounded-lg transition-all ${message.trim() ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30' : 'text-gray-300 dark:text-slate-600 cursor-not-allowed'}`}>
                                <i className="ri-send-plane-fill text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collaborators Panel (Slide Over) */}
                <div className={`sidePanel absolute top-0 left-0 w-full h-full bg-white dark:bg-slate-800 z-20 transition-transform duration-300 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <header className='flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50'>
                        <h1 className='font-bold text-gray-700 dark:text-gray-200'><i className="ri-group-line mr-2"></i>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)} className='p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-gray-400'>
                            <i className="ri-close-line text-xl"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col p-2 gap-1 overflow-y-auto h-full">
                        {project.users && project.users.map(user => (
                            <div key={user._id || user} className="user p-3 flex gap-3 items-center hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg cursor-default transition-colors">
                                <div className='w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm'>
                                    <span className="font-bold text-sm">{(user.email ? user.email[0] : 'U').toUpperCase()}</span>
                                </div>
                                <div>
                                    <h1 className='font-semibold text-sm text-gray-800 dark:text-gray-200'>{user.email || 'Collaborator'}</h1>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Member</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Right Work Area */}
            <section className="right flex-grow h-full flex flex-col bg-gray-900 text-white overflow-hidden">
                
                {/* Explorer & Tabs */}
                <div className="flex h-full">
                    {/* File Explorer */}
                    <div className="explorer w-60 bg-gray-800 dark:bg-slate-900 border-r border-gray-700 dark:border-slate-800 flex flex-col">
                        <div className="p-3 border-b border-gray-700 dark:border-slate-800 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Files
                        </div>
                        <div className="file-tree flex-grow overflow-y-auto">
                            {Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentFile(file)
                                        setOpenFiles([ ...new Set([ ...openFiles, file ]) ])
                                        setActiveTab('editor')
                                    }}
                                    className={`w-full text-left px-4 py-2 flex items-center gap-2 text-sm transition-colors ${currentFile === file ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 dark:hover:bg-slate-800 hover:text-gray-200'}`}>
                                    <i className="ri-file-code-line text-lg opacity-80"></i>
                                    <span className="truncate">{file}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Editor & Preview Area */}
                    <div className="flex-grow flex flex-col h-full bg-[#1e1e1e]">
                        {/* Tabs */}
                        <div className="tabs flex bg-[#252526] border-b border-[#3e3e42] overflow-x-auto no-scrollbar">
                             {openFiles.map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentFile(file)
                                        setActiveTab('editor')
                                    }}
                                    className={`group flex items-center gap-2 px-4 py-2.5 text-sm min-w-32 max-w-48 border-r border-[#3e3e42] transition-colors ${currentFile === file ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'text-gray-400 hover:bg-[#2d2d2d]'}`}>
                                    <span className="truncate flex-grow text-left">{file}</span>
                                    <i 
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const newOpen = openFiles.filter(f => f !== file)
                                            setOpenFiles(newOpen)
                                            if (currentFile === file) setCurrentFile(newOpen[0] || null)
                                        }}
                                        className="ri-close-line opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5"></i>
                                </button>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="toolbar h-12 bg-[#1e1e1e] border-b border-[#3e3e42] flex items-center justify-between px-4">
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setActiveTab('editor')} 
                                    className={`text-sm font-medium transition-colors ${activeTab === 'editor' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                    <i className="ri-code-s-slash-line mr-1"></i> Code
                                </button>
                                <button 
                                    onClick={() => setActiveTab('preview')} 
                                    className={`text-sm font-medium transition-colors ${activeTab === 'preview' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                    <i className="ri-global-line mr-1"></i> Preview
                                </button>
                            </div>
                            
                            <div className="actions flex gap-2">
                                <button
                                    disabled={!webContainer || isRunning}
                                    onClick={async () => {
                                        if (!webContainerRef.current) return;
                                        
                                        setIsRunning(true)
                                        setBuildLogs('Mounting files...\n')
                                        setActiveTab('preview')
                                        
                                        try {
                                            await webContainerRef.current.mount(fileTree)
                                            
                                            // 1. Handle Build/Install
                                            if (latestAiResponse?.buildCommand) {
                                                const { mainItem, commands } = latestAiResponse.buildCommand;
                                                setBuildLogs(prev => prev + `Running build: ${mainItem} ${commands.join(' ')}\n`)
                                                const buildProcess = await webContainerRef.current.spawn(mainItem, commands)
                                                buildProcess.output.pipeTo(new WritableStream({ write(chunk) { setBuildLogs(prev => prev + chunk) } }))
                                                const exitCode = await buildProcess.exit;
                                                if (exitCode !== 0) {
                                                    setBuildLogs(prev => prev + `\nBuild failed with code ${exitCode}\n`)
                                                    setIsRunning(false); return;
                                                }
                                            } else if (fileTree['package.json']) {
                                                setBuildLogs(prev => prev + 'Installing dependencies (npm install)...\n')
                                                const installProcess = await webContainerRef.current.spawn("npm", [ "install" ])
                                                installProcess.output.pipeTo(new WritableStream({ write(chunk) { setBuildLogs(prev => prev + chunk) } }))
                                                const exitCode = await installProcess.exit;
                                                if (exitCode !== 0) {
                                                    setBuildLogs(prev => prev + `\nInstall failed with code ${exitCode}\n`)
                                                    setIsRunning(false); return;
                                                }
                                            }

                                            if (runProcess) runProcess.kill()

                                            // 2. Handle Start/Run
                                            let tempRunProcess;
                                            if (latestAiResponse?.startCommand) {
                                                const { mainItem, commands } = latestAiResponse.startCommand;
                                                setBuildLogs(prev => prev + `Starting: ${mainItem} ${commands.join(' ')}\n`)
                                                tempRunProcess = await webContainerRef.current.spawn(mainItem, commands);
                                            } else {
                                                setBuildLogs(prev => prev + 'Starting application (npm start)...\n')
                                                tempRunProcess = await webContainerRef.current.spawn("npm", [ "start" ]);
                                            }

                                            tempRunProcess.output.pipeTo(new WritableStream({
                                                write(chunk) { setBuildLogs(prev => prev + chunk) }
                                            }))
                                            setRunProcess(tempRunProcess)

                                            webContainerRef.current.on('server-ready', (port, url) => {
                                                setIframeUrl(url)
                                                setIsRunning(false)
                                            })
                                            
                                            // For non-server processes (like a simple C++ run), we might not get 'server-ready'
                                            // Handle manual stop or completion if needed? For now, leave isRunning if it's a server.
                                            // If no server ready within 5 seconds and it's not a common server command, maybe stop loading?
                                            // Actually, the terminal logs show the output, so that's enough for the user.

                                        } catch (err) {
                                            console.error(err)
                                            setBuildLogs(prev => prev + '\nERROR: ' + err.message + '\n')
                                            setIsRunning(false)
                                        }
                                    }}

                                    className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors ${
                                        !webContainer || isRunning 
                                            ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                                    }`}
                                >
                                    {isRunning ? (
                                        <><i className="ri-loader-4-line animate-spin"></i> Running...</>
                                    ) : (
                                        <><i className="ri-play-fill"></i> Run</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="content-area flex-grow relative overflow-auto">
                            {activeTab === 'editor' && currentFile && fileTree[currentFile] && (
                                <div className="code-editor h-full overflow-auto bg-[#1e1e1e] p-4">
                                     <pre className="h-full font-mono text-sm leading-6">
                                        <code
                                            className="h-full outline-none block"
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                                const updatedContent = e.target.innerText;
                                                const ft = { ...fileTree, [currentFile]: { file: { contents: updatedContent } } }
                                                setFileTree(ft)
                                                saveFileTree(ft)
                                            }}
                                            dangerouslySetInnerHTML={{ __html: hljs.highlight('javascript', fileTree[currentFile].file.contents).value }}
                                        />
                                    </pre>
                                </div>
                            )}
                            
                            {activeTab === 'preview' && (
                                <div className="preview h-full w-full bg-white flex flex-col transition-all animate-fadeIn">
                                    {iframeUrl ? (
                                        <>
                                            <div className="url-bar p-2 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                                                <div className="flex gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                                </div>
                                                <input type="text" readOnly value={iframeUrl} className="flex-grow bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded px-3 py-1 text-xs text-gray-600 dark:text-gray-300" />
                                            </div>
                                            <iframe src={iframeUrl} className="flex-grow w-full border-none"></iframe>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:bg-slate-900 overflow-hidden">
                                             <div className="w-full max-w-2xl p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                     <i className={`ri-terminal-box-line text-2xl ${isRunning ? 'text-blue-500 animate-pulse' : 'text-gray-500'}`}></i>
                                                     <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Terminal Output</span>
                                                </div>
                                                <div className="bg-black/90 rounded-lg p-4 font-mono text-xs text-green-400 min-h-[300px] max-h-[600px] overflow-auto shadow-2xl border border-white/5 custom-scrollbar">
                                                    {buildLogs || 'Wait for "Run" button to be ready...'}
                                                    {isRunning && <span className="inline-block w-2 h-4 ml-1 bg-green-400 animate-pulse"></span>}
                                                </div>
                                                <p className="mt-4 text-center text-xs text-gray-500">
                                                    {isRunning ? 'Installing modules and booting server...' : 'The preview will appear here once the server starts.'}
                                                </p>
                                             </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

             {/* Add User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-96 max-w-full relative border border-gray-100 dark:border-slate-700">
                        <header className='flex justify-between items-center mb-6'>
                            <h2 className='text-xl font-bold text-gray-800 dark:text-white'>Select Collaborator</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'>
                                <i className="ri-close-line text-2xl text-gray-500"></i>
                            </button>
                        </header>
                         {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</div>}
                        <div className="users-list flex flex-col gap-2 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {users.map(u => (
                                <div key={u._id} 
                                    className={`cursor-pointer p-3 rounded-lg flex gap-3 items-center transition-all ${
                                        selectedUserId.has(u._id) 
                                        ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-500' 
                                        : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`} 
                                    onClick={() => handleUserClick(u._id)}>
                                    <div className='w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold'>
                                        {u.email ? u.email[0].toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <h3 className='font-medium text-gray-800 dark:text-gray-200'>{u.email || 'Unknown User'}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-500">User</p>
                                    </div>
                                    {selectedUserId.has(u._id) && <i className="ri-check-circle-fill text-blue-600 ml-auto text-xl"></i>}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg shadow-blue-500/30 transition-all'>
                            Add Selected Users
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project