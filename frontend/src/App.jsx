import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Thermometer, Gauge, Activity, Power, Settings2, Database, ChevronDown } from 'lucide-react';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws/data';

function App() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchPorts();
    checkStatus();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (isConnected) {
      connectWebSocket();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isConnected]);

  const fetchPorts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/ports`);
      setPorts(res.data.ports);
      if (res.data.ports.length > 0 && !selectedPort) {
        setSelectedPort(res.data.ports[0]);
      }
    } catch (e) {
      console.error('Failed to fetch ports', e);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/status`);
      setIsConnected(res.data.is_connected);
      if (res.data.is_connected && res.data.port) {
        setSelectedPort(res.data.port);
      }
    } catch (e) {
      console.error('Failed to check status', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/history?limit=50`);
      const formatted = res.data.map(item => ({
        ...item,
        timeStr: new Date(item.timestamp * 1000).toLocaleTimeString()
      }));
      setHistoryData(formatted);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleConnectToggle = async () => {
    if (isConnected) {
      try {
        await axios.post(`${API_URL}/api/disconnect`);
        setIsConnected(false);
        setCurrentData(null);
      } catch (e) {
        console.error('Failed to disconnect', e);
      }
    } else {
      if (!selectedPort) return;
      try {
        await axios.post(`${API_URL}/api/connect`, { port: selectedPort });
        setIsConnected(true);
      } catch (e) {
        alert('Failed to connect to ' + selectedPort);
        console.error('Failed to connect', e);
      }
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setCurrentData(data);
      
      const timeStr = new Date(data.timestamp * 1000).toLocaleTimeString();
      setHistoryData(prev => {
        const newData = [...prev, { ...data, timeStr }];
        if (newData.length > 50) return newData.slice(newData.length - 50);
        return newData;
      });
    };

    ws.onclose = () => {
      console.log('WS disconnected');
    };

    wsRef.current = ws;
  };

  const ParameterCard = ({ title, value, unit, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition-all hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-gray-900">
            {value !== null && value !== undefined ? Number(value).toFixed(2) : '--'}
          </span>
          <span className="text-sm font-medium text-gray-400">{unit}</span>
        </div>
      </div>
      <div className={`p-4 rounded-xl ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">System Monitor</h1>
              <p className="text-xs text-gray-500 font-medium">Real-time Data Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
              <Settings2 size={18} className="text-gray-500" />
              <select 
                className="bg-transparent border-none text-sm font-medium text-gray-700 outline-none pr-8 cursor-pointer appearance-none"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={isConnected}
              >
                {ports.length === 0 ? <option value="">No Ports Found</option> : null}
                {ports.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleConnectToggle}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isConnected 
                  ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
            >
              <Power size={18} />
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Connection Status Banner */}
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Database size={48} className="text-blue-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Connection</h2>
            <p className="text-gray-500 max-w-md">Connect to a COM port to start monitoring real-time data from your HMI system.</p>
          </div>
        )}

        {isConnected && (
          <>
            {/* Key Metrics Grid */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Critical Temperatures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ParameterCard 
                  title="FCU In" value={currentData?.fcu_in} unit="°C" icon={Thermometer} 
                  colorClass="bg-orange-50 text-orange-500" />
                <ParameterCard 
                  title="FCU Out" value={currentData?.fcu_out} unit="°C" icon={Thermometer} 
                  colorClass="bg-orange-50 text-orange-500" />
                <ParameterCard 
                  title="Condenser In" value={currentData?.condenser_in} unit="°C" icon={Thermometer} 
                  colorClass="bg-red-50 text-red-500" />
                <ParameterCard 
                  title="Condenser Out" value={currentData?.condenser_out} unit="°C" icon={Thermometer} 
                  colorClass="bg-red-50 text-red-500" />
                <ParameterCard 
                  title="Evaporator In" value={currentData?.evaporator_in} unit="°C" icon={Thermometer} 
                  colorClass="bg-blue-50 text-blue-500" />
                <ParameterCard 
                  title="Evaporator Out" value={currentData?.evaporator_out} unit="°C" icon={Thermometer} 
                  colorClass="bg-blue-50 text-blue-500" />
                <ParameterCard 
                  title="Room Temp" value={currentData?.room_temp} unit="°C" icon={Thermometer} 
                  colorClass="bg-green-50 text-green-500" />
                <ParameterCard 
                  title="AC Chamber Temp" value={currentData?.ac_chamber_temp} unit="°C" icon={Thermometer} 
                  colorClass="bg-purple-50 text-purple-500" />
              </div>
            </div>

            {/* Pressures and Actuators */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">System Pressures</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ParameterCard 
                    title="Low Pressure (LP)" value={currentData?.lp_psi} unit="psi" icon={Gauge} 
                    colorClass="bg-indigo-50 text-indigo-500" />
                  <ParameterCard 
                    title="High Pressure (HP)" value={currentData?.hp_psi} unit="psi" icon={Gauge} 
                    colorClass="bg-indigo-50 text-indigo-500" />
                  <ParameterCard 
                    title="Water Pressure" value={currentData?.water_pressure_bar} unit="bar" icon={Gauge} 
                    colorClass="bg-cyan-50 text-cyan-500" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Actuator Feedbacks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ParameterCard 
                    title="Heater Actuator" value={currentData?.heater_actuator_feedback} unit="%" icon={Activity} 
                    colorClass="bg-amber-50 text-amber-500" />
                  <ParameterCard 
                    title="Chilled Water Inlet" value={currentData?.chilled_water_inlet_actuator_feedback} unit="%" icon={Activity} 
                    colorClass="bg-teal-50 text-teal-500" />
                  <ParameterCard 
                    title="FCU Bypass" value={currentData?.fcu_bypass_actuator_feedback} unit="%" icon={Activity} 
                    colorClass="bg-rose-50 text-rose-500" />
                  <ParameterCard 
                    title="Condenser Inlet" value={currentData?.condenser_inlet_actuator_feedback} unit="%" icon={Activity} 
                    colorClass="bg-fuchsia-50 text-fuchsia-500" />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Real-time Trends</h3>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="timeStr" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="room_temp" name="Room Temp (°C)" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="fcu_in" name="FCU In (°C)" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="lp_psi" name="Low Pressure (psi)" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="hp_psi" name="High Pressure (psi)" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
