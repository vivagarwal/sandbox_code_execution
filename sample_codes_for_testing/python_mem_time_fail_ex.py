arr = [0] * (10**8)  # Allocating too much memory
print("This should not execute!")

'''
this should give
{
    "exit_code": 137,
    "output": "Killed"
}


for i in range(10**8):  # No large list allocation
    pass
print("Optimized and runs fine!")
this above commented code times out in 10MB, 5sec. but passes for 10 sec

'''
