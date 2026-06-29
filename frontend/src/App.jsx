import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Thermometer, Gauge, Activity, Power, Settings2, Database, Zap, Cpu, BarChart3, Clock } from 'lucide-react';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws/data';

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

const GaugeCard = ({ title, value, colorStroke }) => {
  const val = value !== null && value !== undefined ? Number(value) : 0;
  const boundedVal = Math.min(Math.max(val, 0), 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (boundedVal / 100) * circumference;
  
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center transition-all hover:shadow-md">
      <p className="text-xs font-medium text-gray-500 mb-3 text-center h-8 flex items-center justify-center">{title}</p>
      <div className="relative flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle cx="48" cy="48" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle cx="48" cy="48" r="36" stroke={colorStroke} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{value !== null && value !== undefined ? val.toFixed(1) : '--'}</span>
          <span className="text-[10px] text-gray-400 font-medium uppercase">%</span>
        </div>
      </div>
    </div>
  );
};

const HvacDash = ({ currentData, historyData }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Critical Temperatures</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ParameterCard title="FCU In" value={currentData?.fcu_in} unit="°C" icon={Thermometer} colorClass="bg-orange-50 text-orange-500" />
        <ParameterCard title="FCU Out" value={currentData?.fcu_out} unit="°C" icon={Thermometer} colorClass="bg-orange-50 text-orange-500" />
        <ParameterCard title="Condenser In" value={currentData?.condenser_in} unit="°C" icon={Thermometer} colorClass="bg-red-50 text-red-500" />
        <ParameterCard title="Condenser Out" value={currentData?.condenser_out} unit="°C" icon={Thermometer} colorClass="bg-red-50 text-red-500" />
        <ParameterCard title="Evaporator In" value={currentData?.evaporator_in} unit="°C" icon={Thermometer} colorClass="bg-blue-50 text-blue-500" />
        <ParameterCard title="Evaporator Out" value={currentData?.evaporator_out} unit="°C" icon={Thermometer} colorClass="bg-blue-50 text-blue-500" />
        <ParameterCard title="Room Temp" value={currentData?.room_temp} unit="°C" icon={Thermometer} colorClass="bg-green-50 text-green-500" />
        <ParameterCard title="AC Chamber Temp" value={currentData?.ac_chamber_temp} unit="°C" icon={Thermometer} colorClass="bg-purple-50 text-purple-500" />
        <ParameterCard title="Evap Out Diff" value={currentData?.evaporator_out_diff} unit="°C" icon={Thermometer} colorClass="bg-slate-50 text-slate-500" />
        <ParameterCard title="AC Diff (Chiller)" value={currentData?.air_chamber_diff_chiller} unit="°C" icon={Thermometer} colorClass="bg-sky-50 text-sky-500" />
        <ParameterCard title="AC Diff (Heater)" value={currentData?.air_chamber_diff_heater} unit="°C" icon={Thermometer} colorClass="bg-pink-50 text-pink-500" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">System Pressures</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ParameterCard title="Low Pressure (LP)" value={currentData?.lp_psi} unit="psi" icon={Gauge} colorClass="bg-indigo-50 text-indigo-500" />
          <ParameterCard title="High Pressure (HP)" value={currentData?.hp_psi} unit="psi" icon={Gauge} colorClass="bg-indigo-50 text-indigo-500" />
          <ParameterCard title="Water Pressure" value={currentData?.water_pressure_bar} unit="bar" icon={Gauge} colorClass="bg-cyan-50 text-cyan-500" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Actuator Feedbacks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <GaugeCard title="Heater Actuator" value={currentData?.heater_actuator_feedback} colorStroke="#f59e0b" />
          <GaugeCard title="Chilled Water In" value={currentData?.chilled_water} colorStroke="#ef4444" />
          <GaugeCard title="Evaporator In" value={currentData?.evaporator_out_} colorStroke="#14b8a6" />
          <GaugeCard title="Supply Actuator" value={currentData?.co_supply} colorStroke="#14b8a6" />
          <GaugeCard title="Return Actuator" value={currentData?.co_return} colorStroke="#f43f5e" />
          <GaugeCard title="FCU Bypass" value={currentData?.fcu_bypass_actuator} colorStroke="#8b5cf6" />
        </div>
      </div>
    </div>

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
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
            <Line type="monotone" dataKey="room_temp" name="Room Temp (°C)" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="fcu_in" name="FCU In (°C)" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="lp_psi" name="Low Pressure (psi)" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="hp_psi" name="High Pressure (psi)" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const EnergyMeterDash = ({ currentData, historyData }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
        <Zap className="text-yellow-500" size={20}/> Phase Voltages
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <ParameterCard title="Voltage V1N" value={currentData?.voltage_v1n} unit="V" icon={Zap} colorClass="bg-yellow-50 text-yellow-500" />
         <ParameterCard title="Voltage V2N" value={currentData?.voltage_v2n} unit="V" icon={Zap} colorClass="bg-yellow-50 text-yellow-500" />
         <ParameterCard title="Voltage V3N" value={currentData?.voltage_v3n} unit="V" icon={Zap} colorClass="bg-yellow-50 text-yellow-500" />
         <ParameterCard title="Avg Voltage LN" value={currentData?.avg_voltage_ln} unit="V" icon={Zap} colorClass="bg-yellow-50 text-yellow-600" />
         
         <ParameterCard title="Voltage V12" value={currentData?.voltage_v12} unit="V" icon={Zap} colorClass="bg-orange-50 text-orange-500" />
         <ParameterCard title="Voltage V23" value={currentData?.voltage_v23} unit="V" icon={Zap} colorClass="bg-orange-50 text-orange-500" />
         <ParameterCard title="Voltage V31" value={currentData?.voltage_v31} unit="V" icon={Zap} colorClass="bg-orange-50 text-orange-500" />
         <ParameterCard title="Avg Voltage LL" value={currentData?.avg_voltage_ll} unit="V" icon={Zap} colorClass="bg-orange-50 text-orange-600" />
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
         <Activity className="text-blue-500" size={20}/> Current & Frequency
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <ParameterCard title="Current I1" value={currentData?.current_i1} unit="A" icon={Activity} colorClass="bg-blue-50 text-blue-500" />
         <ParameterCard title="Current I2" value={currentData?.current_i2} unit="A" icon={Activity} colorClass="bg-blue-50 text-blue-500" />
         <ParameterCard title="Current I3" value={currentData?.current_i3} unit="A" icon={Activity} colorClass="bg-blue-50 text-blue-500" />
         <ParameterCard title="Avg Current" value={currentData?.avg_current} unit="A" icon={Activity} colorClass="bg-blue-50 text-blue-600" />
         <ParameterCard title="Frequency" value={currentData?.frequency} unit="Hz" icon={Activity} colorClass="bg-indigo-50 text-indigo-500" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
         <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
           <BarChart3 className="text-green-500" size={20}/> Active Power (kW)
         </h3>
         <div className="grid grid-cols-2 gap-4">
           <ParameterCard title="Power kW1" value={currentData?.kw1} unit="kW" icon={Power} colorClass="bg-green-50 text-green-500" />
           <ParameterCard title="Power kW2" value={currentData?.kw2} unit="kW" icon={Power} colorClass="bg-green-50 text-green-500" />
           <ParameterCard title="Power kW3" value={currentData?.kw3} unit="kW" icon={Power} colorClass="bg-green-50 text-green-500" />
           <ParameterCard title="Total kW" value={currentData?.total_kw} unit="kW" icon={Power} colorClass="bg-green-100 text-green-700" />
         </div>
      </div>
      <div>
         <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
           <Database className="text-purple-500" size={20}/> Energy & Demand
         </h3>
         <div className="grid grid-cols-2 gap-4">
           <ParameterCard title="Total Active Energy" value={currentData?.total_active_energy} unit="kWh" icon={Database} colorClass="bg-purple-50 text-purple-500" />
           <ParameterCard title="Total Apparent Energy" value={currentData?.total_apparent_energy} unit="kVAh" icon={Database} colorClass="bg-purple-50 text-purple-500" />
           <ParameterCard title="Total kVAR" value={currentData?.total_kvar} unit="kVAR" icon={Cpu} colorClass="bg-pink-50 text-pink-500" />
           <ParameterCard title="Avg Power Factor" value={currentData?.avg_pf} unit="" icon={Activity} colorClass="bg-teal-50 text-teal-500" />
         </div>
      </div>
    </div>

    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-8">
      <h3 className="text-lg font-semibold text-gray-900 tracking-tight mb-6">Power Trends (kW & V)</h3>
      <div className="h-80 w-full">
         <ResponsiveContainer width="100%" height="100%">
           <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
             <XAxis dataKey="timeStr" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
             <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
             <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
             <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
             <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
             <Line yAxisId="left" type="monotone" dataKey="total_kw" name="Total Power (kW)" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
             <Line yAxisId="right" type="monotone" dataKey="avg_voltage_ln" name="Avg Voltage (V)" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
             <Line yAxisId="left" type="monotone" dataKey="avg_current" name="Avg Current (A)" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
           </LineChart>
         </ResponsiveContainer>
      </div>
    </div>
  </div>
);

function App() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [activeTab, setActiveTab] = useState('hvac');
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

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col z-20">
        <div className="p-6 h-20 flex items-center border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Database size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">System<br/>Monitor</h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <button 
            onClick={() => setActiveTab('hvac')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${activeTab === 'hvac' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Activity size={20} /> HVAC Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('energy')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${activeTab === 'energy' ? 'bg-yellow-50 text-yellow-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Zap size={20} /> Energy Meter
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
          <div className="px-8 h-20 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
              {activeTab === 'hvac' ? 'HVAC Operations' : 'Energy Analytics'}
            </h2>

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

        {/* Dashboard Content */}
        <main className="flex-1 p-8">
          {!isConnected && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-12 shadow-sm">
              <Database size={56} className="text-gray-300 mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">No Active Connection</h2>
              <p className="text-gray-500 mb-8">Connect to a COM port to start streaming real-time data from the HVAC HMI and Energy Meter devices.</p>
              <button
                onClick={handleConnectToggle}
                className="bg-blue-600 text-white hover:bg-blue-700 px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Power size={20} /> Connect Now
              </button>
            </div>
          )}

          {isConnected && (
            <>
              {activeTab === 'hvac' ? (
                <HvacDash currentData={currentData} historyData={historyData} />
              ) : (
                <EnergyMeterDash currentData={currentData} historyData={historyData} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
