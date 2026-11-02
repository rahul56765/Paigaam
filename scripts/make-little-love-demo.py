#!/usr/bin/env python3
"""Author-owned 24-second instrumental demo; no samples or commercial recording.
Build-time only: Python standard library and system ffmpeg. Not run on deployment.
"""
import math, array, wave, subprocess, tempfile
from pathlib import Path
rate=22050; seconds=24; samples=[0.0]*(rate*seconds)
# Original gentle C/Am/F/G arpeggio, alternating a simple music-box melody.
chords=[(48,52,55,60),(45,52,57,60),(41,48,53,57),(43,50,55,59)]
def note(midi,start,length,volume):
    frequency=440*2**((midi-69)/12)
    for j in range(int(length*rate)):
        k=int(start*rate)+j
        if k>=len(samples):break
        t=j/rate
        envelope=(1-math.exp(-t*70))*math.exp(-t*2.5/length)
        value=sum((.56,.23,.11,.055,.025)[h-1]*math.sin(2*math.pi*frequency*h*t)*math.exp(-t*h*.5) for h in range(1,6))
        samples[k]+=volume*envelope*value
for bar in range(8):
    chord=chords[bar%4]
    for beat in range(6):note(chord[(0,1,2,3,2,1)[beat]],bar*3+beat*.5,2,.16)
    note((72,71,69,67,72,76,74,72)[bar],bar*3+.1,2.7,.12)
peak=max(abs(x) for x in samples) or 1
for i in range(len(samples)):
    fade=min(1,i/(rate*.4),(len(samples)-i)/(rate*1.8))
    samples[i]=int(max(-32767,min(32767,samples[i]/peak*18000*fade)))
destination=Path(__file__).resolve().parents[1]/'public/little-love/little-melody.mp3'
with tempfile.NamedTemporaryFile(suffix='.wav') as f:
    with wave.open(f.name,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(array.array('h',samples).tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',f.name,'-codec:a','libmp3lame','-b:a','96k',str(destination)],check=True)
print(destination)
