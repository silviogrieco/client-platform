export interface PublicKeyResponse {
  n: string;
  g: string;
  pk_fingerprint: string;
}

const API_BASE = import.meta.env.VITE_API_URL

export type ElectionPublicKey = { n: string; g: string; pk_fingerprint: string };

export async function createElectionKeys(electionId: number): Promise<ElectionPublicKey> {
  const res = await fetch(`${API_BASE}/${electionId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Impossibile creare le chiavi per la votazione');
  return res.json();
}

export async function getPublicKey(electionId: number): Promise<ElectionPublicKey> {
  const res = await fetch(`${API_BASE}/${electionId}/public_key`);
  if (!res.ok) throw new Error('Chiave pubblica non trovata per questa votazione');
  return res.json();
}

export async function submitEncryptedVote(
  electionId: number,
  ciphertext: string,
  numUtenti: number,
  topic: string,

) {
  const res = await fetch(`${API_BASE}/${electionId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ ciphertext: ciphertext, topic: topic, num_utenti: numUtenti})
  });
  if (!res.ok) throw new Error('Invio voto fallito');
  return res.json();
}

export interface ResultResponse {
  status: string
}

export async function getResult(votazioneId: number, numUtenti: number): Promise<ResultResponse> {
    const res = await fetch(`${API_BASE}/${votazioneId}/result`, {
    method: "POST",
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({num_utenti: numUtenti})
  });
  if (!res.ok) throw new Error(`Errore recupero risultati: ${res.status}`);
  return res.json();
}

// New types for admin functionality
export type User = { 
  id: string; 
  nome: string; 
  cognome: string; 
  categoria: string; 
  is_admin?: boolean; 
};

export type VoteModel = { 
  id: number; 
  topic: string; 
  categoria: string; 
  concluded: boolean; 
};

export type SimulationStart = { 
  count: number; 
  categoria?: string; 
  topic?: string; 
};

export type SimulationResponse = {
  simulation_id: number;
  categoria: string;
  votazione_id: number;
  generated_users: User[];
  result: { "Totale SI": number; "Totale NO": number; "Totale voti": number };
};

// User management endpoints
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Impossibile caricare gli utenti');
  return res.json();
}

export async function updateUserCategory(userId: string, categoria: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoria })
  });
  if (!res.ok) throw new Error('Impossibile aggiornare la categoria');
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/delete_user`);
  if (!res.ok) throw new Error('Impossibile eliminare l\'utente');
}

// Votazioni endpoint
export async function getAllVotazioni(): Promise<VoteModel[]> {
  const res = await fetch(`${API_BASE}/votazioni`);
  if (!res.ok) throw new Error('Impossibile caricare le votazioni');
  return res.json();
}

// Simulation endpoints
export async function startSimulation(data: SimulationStart): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/simulation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Impossibile avviare la simulazione');
  return res.json();
}

export async function endSimulation(simulationId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/simulation/${simulationId}/end`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Impossibile terminare la simulazione');
}
