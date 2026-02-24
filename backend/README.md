im designing a backend for the app where the web helps users to upload the pdf and generate problems statements, ideas, finalized pdf containing the analysis, user chosen problem statements, product ideas along with detailed explanation.

- There are 4 stages, each is done one after another, and user can come back and edit the prior
- User can regenerate ideas when they need to. Any changes in earlier stage should lead to regenerating data in the subsequent stages,
- When user creates the project, create a new project document
- For example, when user changes stage 2, upserting Stage 3 and Stage 4:

  - If Stage 3 or Stage 4 must be updated when Stage 2 is modified (because they are dependent on Stage 2), then you can perform an upsert or update operation for Stage 3 and Stage 4 to reflect the new changes.

  - If Stage 3 and Stage 4 are empty or unmodified, there is no need to perform an upsert operation on them, unless you're explicitly generating new content for these stages based on the updates in Stage

2.

List of APIs: + "stage 1" api upload pdf: injest service + analysis service -> returns 1 analysis for the uploaded pdf (what is the pdf about)

    + "stage 2" api problem definition:
    	+ Request: Analysis + documents (output of prior stages)
    	+ Response: 4 problem statements based on the analysis,
    	{
    		+ "Problem statement": "explannation"
    	}


    + "stage 3" api:
    	+ Request: Analysis + Problem + documents (output of prior stages)
    	+ Response: 3 products idea + Detailed explanation of idea 1 ...


    + additional api regenerate:

- Regenerate ideas

"final stage" api returns pdf: (Congrats on finishing the workflow here is a documentation for your reference)

Run backend

```
python -m venv env
./env/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload or uvicorn main:app --host 127.0.0.1 --port 8000
```

Connect to EC2 instance:
```
ssh -i "innovation_workflow.pem" ubuntu@ec2-18-224-67-75.us-east-2.compute.amazonaws.com
cd innovation-workflow/backend
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000


# Add 2GB swap
sudo swapoff -a
sudo rm /swapfile
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048  # Creates a 2GB swap instead
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Verify swap
free -h
```
