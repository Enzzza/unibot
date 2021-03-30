using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using CSCompareLib;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;
using Syncfusion.Pdf.Graphics;
using Syncfusion.Pdf.Grid;

namespace API_Test.Controllers
{
    public class QAFormatWrapper
    {
        public string Question { get; set; }
        public string Answer { get; set; }
    }

    [Route("api/[controller]")]
    [EnableCors("AllowAll")]
    public class ValuesController : Controller
    {
      

       
        // GET api/values
        [HttpGet]
        public String Get([FromQuery]string top, [FromQuery]string question)
        {
             List<QAFormatWrapper> ExampleDatabase = new List<QAFormatWrapper>()
        {
            new QAFormatWrapper
            {
                Question = "Koliko košta godina na prvom ciklusu? ",
                Answer = "Svaka godina na prvom ciklusu košta 1800 KM."
            },

            new QAFormatWrapper
            {
                Question = "Koliko košta godina na drugom ciklusu?",
                Answer = "Svaka godina na drugom ciklusu košta 2000 KM."
            },

            new QAFormatWrapper
            {
                Question = "Koliko predmeta mogu da prenesem iz jedne godine u drugu?",
                Answer = "Moguće je prenijeti maksimalno dva predmeta."
            },

            new QAFormatWrapper
            {
                Question = "Koliko košta komisijski izlazak?",
                Answer = "Komisijski izlazak košta 50 KM"
            },

            new QAFormatWrapper
            {
                Question = "Nakon koliko izlazaka moram platiti komisijski?",
                Answer = "Svaki izlazak poslije treceg izlaska se placa komisijski."
            }
        };
            if (question != null && top==null) {
                var A1 = ExampleDatabase
              .OrderByDescending(x => CSCompare.Compute(question, x.Question))
              .FirstOrDefault()
              .Answer;
                return "Answer:" + A1;
            }
            else if (question!= null && top != null)
            {
                string result="";
                
                var possibleMatches = ExampleDatabase
                   .OrderByDescending(x => CSCompare.Compute(question, x.Question))
                   .ToList()
                   .Select(x => x.Answer).Take(Int32.Parse(top));
              
                foreach (var match in possibleMatches)
                {
                    
                        result += match + "\n";
                    
                   
                }
                    

                return result;
            }
            return "You need to provide answer";
           

        }

        // GET api/values/5
        [HttpGet("{id}")]
        public string Get(JsonResult id)
        {
            return "value";
        }

        // POST api/values
        [HttpPost]
        public string Post([FromBody]Suggestion suggestion)
        {
            return suggestion.userSuggestion;
        }

        // PUT api/values/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody]string value)
        {
        }

        // DELETE api/values/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }


    }
    public class Suggestion
    {
        public string userSuggestion { get; set; }
    }
}
