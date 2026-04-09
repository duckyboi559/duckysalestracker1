let data={
stack20:{count:0,price:10},
stack25:{count:0,price:12},
stack30:{count:0,price:15},
your20:{count:0,price:8},
your25:{count:0,price:10},
your30:{count:0,price:12}
}

let history=JSON.parse(localStorage.getItem("pancakeHistory"))||[]

function changeCount(item,amount){
data[item].count+=amount
if(data[item].count<0)data[item].count=0
update()
save()
}

function update(){
Object.keys(data).forEach(i=>{
document.getElementById(i+"Count").textContent=data[i].count
})

let total=0
Object.keys(data).forEach(i=>{
total+=data[i].count*data[i].price
})

document.getElementById("grandTotal").textContent="$"+total
document.getElementById("todayDate").textContent=new Date().toLocaleDateString()
}

function save(){
localStorage.setItem("pancakeCounts",JSON.stringify(data))
localStorage.setItem("pancakeHistory",JSON.stringify(history))
}

function saveDay(){
let total=0
Object.keys(data).forEach(i=>{
total+=data[i].count*data[i].price
})

let entry={
date:new Date().toLocaleDateString(),
total:total,
data:JSON.parse(JSON.stringify(data))
}

history.push(entry)

Object.keys(data).forEach(i=>{
data[i].count=0
})

save()
renderHistory()
update()
}

function resetDay(){
Object.keys(data).forEach(i=>{
data[i].count=0
})
update()
save()
}

function renderHistory(){
let list=document.getElementById("historyList")
list.innerHTML=""

history.slice().reverse().forEach(day=>{
let div=document.createElement("div")
div.className="history-entry"
div.innerHTML=`
<strong>${day.date}</strong><br>
Total: $${day.total}
`
list.appendChild(div)
})
}

let saved=localStorage.getItem("pancakeCounts")
if(saved){
data=JSON.parse(saved)
}

renderHistory()
update()
