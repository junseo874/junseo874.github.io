using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;
public static class ExportGradeAmbient {
 [Serializable]public class Pack{public Grade[] grades;public int fps=60;}
 [Serializable]public class Grade{public string id;public Layer[] layers;public Frame[] frames;public Frame[] glow;public float glowPeriod;}
 [Serializable]public class Layer{public string name;public bool loop;public float duration,delay,lifetime,ringStart,ringEnd;}
 [Serializable]public class Frame{public float t;public float[] particles;}
 public static void Run(){try{
 var ids=new[]{"excellent","good","decent","poor","sewage"};var names=new[]{"Excellent_Gold","Good_Green","Decent_Cyan","Poor_Red","Sewage_Purple"};var grades=new List<Grade>();Time.fixedDeltaTime=1f/60;
 for(int k=0;k<5;k++){
 var go=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/01.Game/03.Content/08.Prefabs/05.Vfx/02.GradeColorSet/FX_GradeReveal_"+names[k]+".prefab"));var root=go.GetComponent<ParticleSystem>();var systems=go.GetComponentsInChildren<ParticleSystem>();
 for(int j=0;j<systems.Length;j++){systems[j].Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);systems[j].useAutoRandomSeed=false;systems[j].randomSeed=(uint)(103+j*97);}
 var ambient=systems.Select((p,j)=>(p,j)).Where(a=>new[]{"FX_GradeReveal_BackBar","FX_GradeReveal_Twinkle","FX_GradeReveal_Float"}.Contains(a.p.name)).ToArray();
 var layers=ambient.Select(a=>new Layer{name=a.p.name,loop=a.p.main.loop,duration=a.p.main.duration,delay=a.p.main.startDelay.constant,lifetime=a.p.main.startLifetime.constantMax,ringStart=a.p.main.ringBufferLoopRange.x,ringEnd=a.p.main.ringBufferLoopRange.y}).ToArray();foreach(var l in layers)Debug.Log(ids[k]+" ambient "+JsonUtility.ToJson(l));
 var frames=new List<Frame>();for(int f=0;f<=960;f++){float t=f/60f;root.Simulate(t,true,true,true);var values=new List<float>();foreach(var a in ambient){var ps=a.p;var list=new ParticleSystem.Particle[ps.particleCount];int n=ps.GetParticles(list);var spriteFrames=ExportGrade.SpriteFrames(ps,list);for(int i=0;i<n;i++){var p=list[i];var pos=ps.main.simulationSpace==ParticleSystemSimulationSpace.World?p.position:ps.transform.TransformPoint(p.position);var size=Vector3.Scale(p.GetCurrentSize3D(ps),ps.transform.lossyScale);var c=p.GetCurrentColor(ps);values.AddRange(new[]{(float)a.j,pos.x,pos.y,pos.z,size.x,size.y,p.rotation3D.z+ps.transform.eulerAngles.z,c.r/255f,c.g/255f,c.b/255f,c.a/255f,spriteFrames[i],t-(p.startLifetime-p.remainingLifetime)});}}
 frames.Add(new Frame{t=t,particles=values.ToArray()});}
 var glowSystem=ambient.First(a=>a.p.name=="FX_GradeReveal_BackBar");float period=glowSystem.p.main.startLifetime.constantMax*(glowSystem.p.main.ringBufferLoopRange.y-glowSystem.p.main.ringBufferLoopRange.x);var glow=new List<Frame>();for(int f=0;f<96;f++){float t=3.4f+period*f/96;root.Simulate(t,true,true,true);var ps=glowSystem.p;var pp=new ParticleSystem.Particle[ps.particleCount];ps.GetParticles(pp);var vv=new List<float>();foreach(var p in pp){var pos=ps.transform.TransformPoint(p.position);var size=Vector3.Scale(p.GetCurrentSize3D(ps),ps.transform.lossyScale);var c=p.GetCurrentColor(ps);vv.AddRange(new[]{(float)glowSystem.j,pos.x,pos.y,pos.z,size.x,size.y,p.rotation3D.z+ps.transform.eulerAngles.z,c.r/255f,c.g/255f,c.b/255f,c.a/255f,-1});}glow.Add(new Frame{t=t,particles=vv.ToArray()});}
 grades.Add(new Grade{id=ids[k],layers=layers,frames=frames.ToArray(),glow=glow.ToArray(),glowPeriod=period});UnityEngine.Object.DestroyImmediate(go);
 }
 File.WriteAllText("/tmp/grade-engine-ambient.json",JsonUtility.ToJson(new Pack{grades=grades.ToArray()}));EditorApplication.Exit(0);
 }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
}
