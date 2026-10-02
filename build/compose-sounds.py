#!/usr/bin/env python3
"""Reproducible original 'Quiet Wood' cues. No recordings or third-party samples.
Offline modal string/body synthesis, stored as lossless PCM; browser only plays buffers.
"""
import math, random, wave, struct, json
from pathlib import Path
RATE=22050
ROOT=Path(__file__).resolve().parent.parent/'source/assets/sounds'
# A shared D-major/pentatonic vocabulary: open, settle, return, resolve.
PHRASES={
 'begin':[(0,62,.70,1),(.16,69,.70,.82),(.31,74,.72,.62)],
 'pause':[(0,69,.46,.65),(.10,66,.43,.7)],
 'resume':[(0,66,.44,.7),(.12,69,.50,.8)],
 'skip':[(0,69,.35,.7),(.09,71,.38,.55)],
 'complete':[(0,69,.65,.7),(.14,66,.67,.7),(.29,74,.78,1)],
 'day':[(0,62,1,.66),(.12,66,.95,.6),(.25,69,.92,.65),(.42,74,1.02,.85)],
 'invitation':[(0,66,.65,.8),(.26,71,.75,.65)],
 'return':[(0,69,.62,.65),(.18,74,.75,.86)],
 'overtime':[(0,62,.60,.82),(.23,69,.65,.85)],
 'target':[(0,69,.55,.65),(.16,66,.6,.8)],
 'hint':[(0,69,.35,.60)],
 'confirm':[(0,74,.38,.66),(.075,78,.39,.45)],
 'attention':[(0,66,.68,.85),(.22,62,.80,.95)]
}
def tone(midi,duration,seed):
 rng=random.Random(seed);f=440*2**((midi-69)/12);length=int(duration*RATE)
 phases=[rng.uniform(-.06,.06) for _ in range(8)];out=[]
 for i in range(length):
  t=i/RATE;attack=1-math.exp(-t/.008)
  # Inharmonic string modes with faster high-mode damping and a quiet wooden body.
  value=sum((1/k**1.85)*math.exp(-t*(5.1+1.9*k)/duration)*math.sin(2*math.pi*f*k*math.sqrt(1+.00016*k*k)*t+phases[k-1]) for k in range(1,9))
  value+=.085*math.exp(-t/ .048)*math.sin(2*math.pi*183*t)+.023*math.exp(-t/.014)*rng.uniform(-1,1)
  value*=attack*min(1,max(0,(duration-t)/.065))
  out.append(value)
 return out
manifest=[]
for ni,(name,notes) in enumerate(PHRASES.items()):
 length=int((max(at+dur for at,_,dur,_ in notes)+.1)*RATE);data=[0.0]*length
 for j,(at,midi,dur,velocity) in enumerate(notes):
  sound=tone(midi,dur,41+ni*17+j)
  for delay,level in [(0,1),(.023,.055),(.051,.028)]:
   offset=int((at+delay)*RATE)
   for k,value in enumerate(sound):
    if offset+k<length:data[offset+k]+=value*velocity*level
 rms=math.sqrt(sum(x*x for x in data)/len(data));peak=max(abs(x) for x in data)
 scale=min(.055/rms,.43/peak)
 data=[x*scale for x in data]
 with wave.open(str(ROOT/(name+'.wav')),'wb') as w:
  w.setparams((1,2,RATE,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',round(x*32767)) for x in data))
 manifest.append({'cue':name,'seconds':round(len(data)/RATE,3),'peak':round(max(abs(x) for x in data),4),'rms':round(math.sqrt(sum(x*x for x in data)/len(data)),4)})
(ROOT/'manifest.json').write_text(json.dumps({'family':'Quiet Wood','sampleRate':RATE,'channels':1,'bits':16,'cues':manifest},indent=2)+'\n')
print(json.dumps(manifest))
